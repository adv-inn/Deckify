import unittest
from email.message import Message
from unittest.mock import AsyncMock, Mock, patch
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request

from test_token_refresh import main


IMAGE = "https://i.scdn.co/image/album-cover"


class ImageTests(unittest.TestCase):
    def test_image_url_preserves_source_query(self):
        source = IMAGE + "?size=300&format=jpeg"
        local = urlsplit(main._image_url([{"url": source}]))
        self.assertEqual(local.netloc, "127.0.0.1:39282")
        self.assertEqual(local.path, "/api/image")
        self.assertEqual(parse_qs(local.query), {"url": [source]})
        self.assertIsNone(main._image_url([]))

    def test_non_spotify_urls_are_rejected_before_fetch(self):
        urls = ["http://i.scdn.co/image/a", "https://127.0.0.1/a",
                "https://i.scdn.co.example.com/a", "file:///etc/passwd",
                "https://user:password@i.scdn.co/a", "https://i.scdn.co:1337/a", ""]
        with patch.object(main.urllib.request, "build_opener") as opener:
            for url in urls:
                with self.subTest(url=url), self.assertRaises(ValueError):
                    main._fetch_spotify_image(url)
            opener.assert_not_called()

    def test_redirects_stay_on_spotify_image_hosts(self):
        handler = main._ImageRedirectHandler()
        request = Request(IMAGE)
        redirected = handler.redirect_request(
            request, None, 302, "Found", {}, "https://image-cdn-ak.spotifycdn.com/image/a",
        )
        self.assertEqual(redirected.host, "image-cdn-ak.spotifycdn.com")
        with self.assertRaises(ValueError):
            handler.redirect_request(request, None, 302, "Found", {}, "https://localhost/a")

    def response(self, content_type, body):
        response = Mock()
        response.headers = Message()
        response.headers["Content-Type"] = content_type
        response.read.return_value = body
        opener = self.enterContext(patch.object(main.urllib.request, "build_opener"))
        opener.return_value.open.return_value.__enter__.return_value = response

    def test_image_bytes_and_type_are_preserved(self):
        self.response("image/jpeg", b"\xff\xd8cover\xff\xd9")
        self.assertEqual(main._fetch_spotify_image(IMAGE), ("image/jpeg", b"\xff\xd8cover\xff\xd9"))

    def test_html_is_not_forwarded_as_an_image(self):
        self.response("text/html", b"<html>upstream error</html>")
        with self.assertRaises(RuntimeError):
            main._fetch_spotify_image(IMAGE)

    def test_oversized_images_are_rejected(self):
        self.response("image/jpeg", b"12345")
        with patch.object(main, "MAX_IMAGE_BYTES", 4), self.assertRaises(RuntimeError):
            main._fetch_spotify_image(IMAGE)


class ImageResponseTests(unittest.IsolatedAsyncioTestCase):
    async def test_image_response_is_binary_and_cacheable(self):
        writer = Mock(drain=AsyncMock())
        with patch.object(main, "_exec", new=AsyncMock(return_value=("image/png", b"\x89PNG"))):
            await main.Plugin()._serve_image(writer, IMAGE)
        header, body = writer.write.call_args.args[0].split(b"\r\n\r\n", 1)
        self.assertIn(b"HTTP/1.1 200 OK", header)
        self.assertIn(b"Content-Type: image/png", header)
        self.assertIn(b"Content-Length: 4", header)
        self.assertIn(b"Cache-Control: public, max-age=86400", header)
        self.assertEqual(body, b"\x89PNG")
        writer.close.assert_called_once()

    async def test_failed_downloads_do_not_return_a_broken_success(self):
        for error, status in [(ValueError("invalid URL"), 400), (TimeoutError("offline"), 502)]:
            with self.subTest(status=status):
                writer = Mock(drain=AsyncMock())
                with patch.object(main, "_exec", new=AsyncMock(side_effect=error)):
                    await main.Plugin()._serve_image(writer, IMAGE)
                self.assertTrue(writer.write.call_args.args[0].startswith(f"HTTP/1.1 {status} ".encode()))


if __name__ == "__main__":
    unittest.main()
