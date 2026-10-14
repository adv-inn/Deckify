import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

from test_token_refresh import main


class DeviceNameTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.directory = self.enterContext(tempfile.TemporaryDirectory())
        self.settings_file = Path(self.directory, "settings.json")
        self.enterContext(patch.object(main, "SETTINGS_FILE", str(self.settings_file)))

    def test_existing_settings_preserve_custom_names_and_credentials(self):
        for saved_name, expected in [("Steam Deck", ""), ("Living Room", "Living Room"), ("", "")]:
            with self.subTest(name=saved_name):
                self.settings_file.write_text(json.dumps({
                    "device_name": saved_name, "refresh_token": "saved-token",
                }))
                settings = main._load_settings()
                self.assertEqual(settings["device_name"], expected)
                self.assertEqual(settings["refresh_token"], "saved-token")

    async def test_explicit_legacy_name_is_preserved_after_saving(self):
        plugin = main.Plugin()
        plugin._settings = main._load_settings()
        result = await plugin.set_setting("device_name", "  Steam Deck  ")
        self.assertTrue(result["ok"])
        self.assertEqual(main._load_settings()["device_name"], "Steam Deck")

    async def test_clearing_name_restores_automatic_mode(self):
        plugin = main.Plugin()
        plugin._settings = {"device_name": "Living Room"}
        self.assertTrue((await plugin.set_setting("device_name", "   "))["ok"])
        self.assertEqual(main._load_settings()["device_name"], "")

    async def test_invalid_names_do_not_change_settings(self):
        plugin = main.Plugin()
        plugin._settings = {"device_name": "Living Room"}
        for value in [None, 42, "bad\x00name", "bad\nname"]:
            with self.subTest(value=value):
                self.assertFalse((await plugin.set_setting("device_name", value))["ok"])
                self.assertEqual(plugin._settings, {"device_name": "Living Room"})
        self.assertFalse(self.settings_file.exists())

    async def test_start_uses_current_hostname_or_explicit_name(self):
        for saved_name, hostname, expected in [
            ("", "steammachine", "steammachine"),
            ("", "SteamDeck", "SteamDeck"),
            ("Living Room", "steammachine", "Living Room"),
        ]:
            with self.subTest(name=saved_name, hostname=hostname):
                plugin = main.Plugin()
                plugin._settings = {**main.DEFAULT_SETTINGS, "device_name": saved_name}
                process = Mock(pid=123)
                with patch.object(main.socket, "gethostname", return_value=hostname), \
                        patch.object(main, "CACHE_DIR", self.directory), \
                        patch.object(main.os.path, "isfile", return_value=True), \
                        patch.object(main.subprocess, "Popen", return_value=process) as popen, \
                        patch.object(plugin, "_kill_stale_librespot"), \
                        patch.object(plugin, "_write_pid"), \
                        patch.object(plugin, "_start_monitor"), \
                        patch.object(main.decky, "emit", new=AsyncMock()):
                    self.assertTrue((await plugin.start_librespot())["ok"])
                command = popen.call_args.args[0]
                self.assertEqual(command[command.index("--name") + 1], expected)

    def test_new_install_uses_automatic_mode(self):
        self.assertEqual(main._load_settings()["device_name"], "")


if __name__ == "__main__":
    unittest.main()
