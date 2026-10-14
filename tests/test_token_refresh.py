import asyncio
import io
import tempfile
import time
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from urllib.error import HTTPError


with patch.dict("sys.modules", {"decky": SimpleNamespace(
    DECKY_PLUGIN_SETTINGS_DIR=tempfile.gettempdir(),
    DECKY_PLUGIN_DIR=tempfile.gettempdir(),
    DECKY_PLUGIN_RUNTIME_DIR=tempfile.gettempdir(),
    logger=Mock(),
    emit=AsyncMock(),
)}):
    import main


class TokenRefreshTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.plugin = main.Plugin()
        self.plugin._token_refresh_lock = asyncio.Lock()
        self.plugin._access_token = "old-access"
        self.plugin._refresh_token = "old-refresh"
        self.plugin._settings = {
            "access_token": "old-access",
            "refresh_token": "old-refresh",
            "token_expires_at": 0,
            "spotify_client_id": "saved-client",
        }
        self.execute = self.enterContext(patch.object(main, "_exec", new_callable=AsyncMock))
        self.save = self.enterContext(patch.object(main, "_save_settings"))
        self.emit = self.enterContext(patch.object(main.decky, "emit", new_callable=AsyncMock))
        self.clock = Mock(return_value=100)
        self.enterContext(patch.object(main, "time", SimpleNamespace(time=time.time, monotonic=self.clock)))

    def fail_http(self, status, body):
        self.execute.side_effect = HTTPError(
            main.SPOTIFY_TOKEN_URL, status, "Failure", {}, io.BytesIO(body),
        )

    async def test_revoked_authorization_is_cleared_once_for_concurrent_callers(self):
        async def revoked(*_args):
            await asyncio.sleep(0)
            raise HTTPError(main.SPOTIFY_TOKEN_URL, 400, "Failure", {},
                            io.BytesIO(b'{"error":"invalid_grant"}'))

        self.execute.side_effect = revoked
        results = await asyncio.gather(*(self.plugin._ensure_token() for _ in range(5)))
        self.assertEqual(results, [None] * 5)
        self.execute.assert_awaited_once()
        self.emit.assert_awaited_once_with("auth_expired")
        self.save.assert_called_once_with({"spotify_client_id": "saved-client"})
        self.assertFalse((await self.plugin.get_auth_status())["authenticated"])
        self.assertIsNone(await self.plugin._ensure_token())

    async def test_invalid_client_requires_reconnection(self):
        self.fail_http(401, b'{"error":"invalid_client"}')
        self.assertIsNone(await self.plugin._ensure_token())
        self.assertIsNone(self.plugin._refresh_token)
        self.emit.assert_awaited_once_with("auth_expired")

    async def test_other_http_failures_keep_credentials_and_back_off(self):
        for status, body in [(400, b'{"error":"invalid_request"}'),
                             (502, b"<html>Bad Gateway</html>"),
                             (504, b'{"error":"invalid_grant"}')]:
            with self.subTest(status=status):
                self.plugin._token_retry_at = 0
                self.execute.reset_mock()
                self.fail_http(status, body)
                self.assertIsNone(await self.plugin._ensure_token())
                self.assertIsNone(await self.plugin._ensure_token())
                self.execute.assert_awaited_once()
                self.assertEqual(self.plugin._refresh_token, "old-refresh")
                self.assertEqual(self.plugin._token_retry_at, 130)
        self.save.assert_not_called()
        self.emit.assert_not_awaited()

    async def test_network_failure_can_recover_after_backoff(self):
        self.execute.side_effect = TimeoutError("offline")
        self.assertIsNone(await self.plugin._ensure_token())
        self.assertIsNone(await self.plugin._ensure_token())
        self.execute.assert_awaited_once()
        self.clock.return_value = 131
        self.execute.side_effect = None
        self.execute.return_value = {"access_token": "new-access", "expires_in": 3600}
        self.assertEqual(await self.plugin._ensure_token(), "new-access")
        self.assertEqual(self.plugin._refresh_token, "old-refresh")
        self.assertEqual(self.execute.await_count, 2)

    async def test_rotated_refresh_token_is_persisted(self):
        self.execute.return_value = {"access_token": "new-access", "refresh_token": "new-refresh"}
        self.assertEqual(await self.plugin._ensure_token(), "new-access")
        self.assertEqual(self.plugin._settings["refresh_token"], "new-refresh")
        self.save.assert_called_once()

    async def test_reauthorization_resets_backoff(self):
        self.plugin._token_retry_at = 999
        self.execute.return_value = {"access_token": "new-access", "refresh_token": "new-refresh"}
        self.plugin._send_html = AsyncMock()
        self.plugin._start_api_poll = Mock()
        await self.plugin._handle_oauth_callback("code=test-code", None)
        self.assertEqual(self.plugin._token_retry_at, 0)
        self.assertTrue((await self.plugin.get_auth_status())["authenticated"])
        self.emit.assert_awaited_once_with("oauth_complete", {"authenticated": True})


if __name__ == "__main__":
    unittest.main()
