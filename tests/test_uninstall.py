import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


SHELL = shutil.which("sh")
if not SHELL and os.name == "nt":
    git_shell = Path(os.environ.get("ProgramFiles", "C:/Program Files"), "Git/bin/sh.exe")
    if git_shell.is_file():
        SHELL = str(git_shell)


def shell_path(path):
    value = Path(path).resolve().as_posix()
    return f"/{value[0].lower()}{value[2:]}" if os.name == "nt" else value


@unittest.skipUnless(SHELL, "POSIX shell required")
class UninstallTests(unittest.TestCase):
    def setUp(self):
        self.directory = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.home = self.directory / "home with spaces"
        self.plugin = self.home / "homebrew/plugins/Deckify"
        self.plugin.mkdir(parents=True)
        self.log = self.directory / "commands"
        self.bin = self.directory / "bin"
        self.bin.mkdir()
        sudo = self.bin / "sudo"
        sudo.write_text(
            '#!/bin/sh\nprintf "%s\\t" "$@" >> "$COMMAND_LOG"\n'
            'printf "\\n" >> "$COMMAND_LOG"\n'
            'if [ "$1" = rm ] && [ "$FAIL_REMOVE" = 1 ]; then exit 1; fi\n'
            'if [ "$1 $2" = "systemctl stop" ] && [ "$FAIL_STOP" = 1 ]; then exit 1; fi\n'
            'exit 0\n', encoding="utf-8", newline="\n",
        )
        sudo.chmod(0o755)
        self.script = self.directory / "uninstall.sh"
        source = Path(__file__).resolve().parents[1] / "uninstall.sh"
        self.script.write_text(source.read_text(), encoding="utf-8", newline="\n")

    def run_script(self, *args, **overrides):
        env = {**os.environ, "TEST_HOME": overrides.pop("HOME", shell_path(self.home)),
               "TEST_SCRIPT": shell_path(self.script), "TEST_BIN": shell_path(self.bin),
               "COMMAND_LOG": shell_path(self.log), "FAIL_REMOVE": "0", "FAIL_STOP": "0", **overrides}
        result = subprocess.run(
            [SHELL, "-c", 'PATH="$TEST_BIN:$PATH"; HOME="$TEST_HOME"; export PATH HOME; . "$TEST_SCRIPT"',
             "uninstall-test", *args],
            env=env, capture_output=True, text=True, timeout=10,
        )
        commands = [line.rstrip("\t").split("\t") for line in self.log.read_text().splitlines()] if self.log.exists() else []
        return result, commands

    def test_default_uninstall_only_removes_plugin(self):
        result, commands = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(commands, [
            ["systemctl", "stop", "plugin_loader"],
            ["rm", "-rf", "--", shell_path(self.plugin)],
            ["systemctl", "start", "plugin_loader"],
        ])

    def test_purge_removes_only_current_and_legacy_deckify_data(self):
        result, commands = self.run_script("--purge")
        self.assertEqual(result.returncode, 0, result.stderr)
        targets = [
            "homebrew/settings/Deckify", "homebrew/data/Deckify", "homebrew/logs/Deckify",
            "homebrew/settings/deckify.json", "homebrew/deckify", ".config/deckify", ".local/share/deckify",
        ]
        self.assertEqual(commands, [
            ["systemctl", "stop", "plugin_loader"],
            ["rm", "-rf", "--", shell_path(self.plugin)],
            ["rm", "-rf", "--", *[shell_path(self.home / target) for target in targets]],
            ["systemctl", "start", "plugin_loader"],
        ])

    def test_purge_works_after_plugin_was_already_removed(self):
        self.plugin.rmdir()
        result, commands = self.run_script("--purge")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(commands), 4)

    def test_missing_plugin_without_purge_does_not_touch_service_or_data(self):
        self.plugin.rmdir()
        result, commands = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(commands, [])

    def test_failure_to_remove_still_starts_loader(self):
        result, commands = self.run_script("--purge", FAIL_REMOVE="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(commands[-1], ["systemctl", "start", "plugin_loader"])
        self.assertEqual(len(commands), 3)

    def test_stop_failure_does_not_delete_files(self):
        result, commands = self.run_script("--purge", FAIL_STOP="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(commands, [["systemctl", "stop", "plugin_loader"]])

    def test_invalid_arguments_do_not_run_privileged_commands(self):
        for args in [("--all",), ("--purge", "unexpected")]:
            with self.subTest(args=args):
                result, commands = self.run_script(*args)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(commands, [])

    def test_help_and_unsafe_home_do_not_run_privileged_commands(self):
        result, commands = self.run_script("--help")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(commands, [])
        for home in ["/", "", "relative/path"]:
            with self.subTest(home=home):
                result, commands = self.run_script("--purge", HOME=home)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(commands, [])


if __name__ == "__main__":
    unittest.main()
