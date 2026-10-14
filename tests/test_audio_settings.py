import asyncio
import importlib
import logging
import os
import sys
import tempfile
import types
import unittest
from unittest.mock import AsyncMock, MagicMock, patch


class AudioSettingsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tempdir = tempfile.TemporaryDirectory()
        cls.previous_decky = sys.modules.get("decky")
        decky = types.ModuleType("decky")
        decky.DECKY_PLUGIN_SETTINGS_DIR = cls.tempdir.name
        decky.DECKY_PLUGIN_RUNTIME_DIR = cls.tempdir.name
        decky.DECKY_PLUGIN_DIR = cls.tempdir.name
        decky.DECKY_USER_HOME = cls.tempdir.name
        decky.DECKY_HOME = cls.tempdir.name
        decky.logger = logging.getLogger("deckify-tests")
        decky.emit = AsyncMock()
        decky.migrate_logs = MagicMock()
        decky.migrate_settings = MagicMock()
        decky.migrate_runtime = MagicMock()
        sys.modules["decky"] = decky
        cls.main = importlib.import_module("main")

    @classmethod
    def tearDownClass(cls):
        if cls.previous_decky is None:
            sys.modules.pop("decky", None)
        else:
            sys.modules["decky"] = cls.previous_decky
        cls.tempdir.cleanup()

    def setUp(self):
        self.plugin = self.main.Plugin()
        self.plugin._settings = dict(self.main.DEFAULT_SETTINGS)
        self.plugin._poll_volume = None
        self.plugin._pa_sink_input_id = None
        self.plugin._applied_output_gain = None

    def run_async(self, coroutine):
        return asyncio.run(coroutine)

    def test_set_volume_persists_only_after_spotify_accepts_it(self):
        self.plugin._ensure_token = AsyncMock(return_value="token")

        with patch.object(self.main, "_exec", AsyncMock(return_value=None)), patch.object(self.main, "_save_settings") as save:
            result = self.run_async(self.plugin.set_volume(23))

        self.assertTrue(result["ok"])
        self.assertEqual(self.plugin._poll_volume, 23)
        self.assertEqual(self.plugin._settings["volume"], 23)
        save.assert_called_once()

        with patch.object(self.main, "_exec", AsyncMock(side_effect=RuntimeError("rejected"))), patch.object(self.main, "_save_settings") as save:
            result = self.run_async(self.plugin.set_volume(31))

        self.assertFalse(result["ok"])
        self.assertEqual(self.plugin._settings["volume"], 23)
        save.assert_not_called()

    def test_start_librespot_passes_persisted_initial_volume(self):
        self.plugin._settings["volume"] = 23
        process = MagicMock(pid=321)
        process.poll.return_value = None

        with patch.object(os.path, "isfile", return_value=True), patch.object(self.main.subprocess, "Popen", return_value=process) as popen, patch.object(self.plugin, "_write_pid"), patch.object(self.plugin, "_start_monitor"):
            result = self.run_async(self.plugin.start_librespot())

        command = popen.call_args.args[0]
        volume_index = command.index("--initial-volume")
        self.assertEqual(command[volume_index + 1], "23")
        self.assertTrue(result["ok"])

    def test_output_gain_resets_existing_stream_to_default(self):
        self.plugin._process = MagicMock(pid=123)
        list_result = MagicMock(returncode=0, stdout='Sink Input #42\napplication.process.id = "123"\n', stderr="")
        set_result = MagicMock(returncode=0, stdout="", stderr="")

        async def execute(function, *args, **kwargs):
            return function(*args)

        with patch.object(self.main, "_exec", side_effect=execute), patch.object(self.main.subprocess, "run", side_effect=[list_result, set_result]) as run:
            self.run_async(self.plugin._apply_output_gain())

        self.assertEqual(run.call_args_list[1].args[0][-1], "100%")
        self.assertEqual(self.plugin._applied_output_gain, 100)

    def test_runtime_output_gain_change_persists_and_applies(self):
        self.plugin._process = MagicMock()
        self.plugin._process.poll.return_value = None
        self.plugin._apply_output_gain = AsyncMock()

        with patch.object(self.main, "_save_settings") as save:
            result = self.run_async(self.plugin.set_setting("output_gain", 125))

        self.assertTrue(result["ok"])
        self.assertEqual(self.plugin._settings["output_gain"], 125)
        save.assert_called_once()
        self.plugin._apply_output_gain.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
