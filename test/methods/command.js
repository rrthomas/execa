import {join} from 'node:path';
import test from 'ava';
import {execaCommand, execaCommandSync} from '../../index.js';
import {setFixtureDirectory, FIXTURES_DIRECTORY} from '../helpers/fixtures-directory.js';
import {QUOTE} from '../helpers/verbose.js';

setFixtureDirectory();
const STDIN_FIXTURE = join(FIXTURES_DIRECTORY, 'stdin.js');

test('execaCommand()', async t => {
	const {stdout} = await execaCommand('echo.js foo bar');
	t.is(stdout, 'foo\nbar');
});

test('execaCommandSync()', t => {
	const {stdout} = execaCommandSync('echo.js foo bar');
	t.is(stdout, 'foo\nbar');
});

test('execaCommand`...`', async t => {
	const {stdout} = await execaCommand`${'echo.js foo bar'}`;
	t.is(stdout, 'foo\nbar');
});

test('execaCommandSync`...`', t => {
	const {stdout} = execaCommandSync`${'echo.js foo bar'}`;
	t.is(stdout, 'foo\nbar');
});

test('execaCommand(options)`...`', async t => {
	const {stdout} = await execaCommand({stripFinalNewline: false})`${'echo.js foo bar'}`;
	t.is(stdout, 'foo\nbar\n');
});

test('execaCommandSync(options)`...`', t => {
	const {stdout} = execaCommandSync({stripFinalNewline: false})`${'echo.js foo bar'}`;
	t.is(stdout, 'foo\nbar\n');
});

test('execaCommand(options)()', async t => {
	const {stdout} = await execaCommand({stripFinalNewline: false})('echo.js foo bar');
	t.is(stdout, 'foo\nbar\n');
});

test('execaCommandSync(options)()', t => {
	const {stdout} = execaCommandSync({stripFinalNewline: false})('echo.js foo bar');
	t.is(stdout, 'foo\nbar\n');
});

test('execaCommand().pipe(execaCommand())', async t => {
	const {stdout} = await execaCommand('echo.js foo bar').pipe(execaCommand(`node ${STDIN_FIXTURE}`));
	t.is(stdout, 'foo\nbar');
});

test('execaCommand().pipe(...) does not use execaCommand', async t => {
	const {escapedCommand} = await execaCommand('echo.js foo bar').pipe(`node ${STDIN_FIXTURE}`, {reject: false});
	t.true(escapedCommand.startsWith(`${QUOTE}node `));
});

test('execaCommand() bound options have lower priority', async t => {
	const {stdout} = await execaCommand({stripFinalNewline: false})('echo.js foo bar', {stripFinalNewline: true});
	t.is(stdout, 'foo\nbar');
});

test('execaCommandSync() bound options have lower priority', t => {
	const {stdout} = execaCommandSync({stripFinalNewline: false})('echo.js foo bar', {stripFinalNewline: true});
	t.is(stdout, 'foo\nbar');
});

test('execaCommand() allows escaping spaces in commands', async t => {
	const {stdout} = await execaCommand('command\\ with\\ space.js foo bar');
	t.is(stdout, 'foo\nbar');
});

test('execaCommand() trims', async t => {
	const {stdout} = await execaCommand('  echo.js foo bar  ');
	t.is(stdout, 'foo\nbar');
});

const testExecaCommandOutput = async (t, commandArguments, expectedOutput) => {
	const {stdout} = await execaCommand(`echo.js ${commandArguments}`);
	t.is(stdout, expectedOutput);
};

test('execaCommand() ignores consecutive spaces', testExecaCommandOutput, 'foo    bar', 'foo\nbar');
test('execaCommand() escapes other whitespaces', testExecaCommandOutput, 'foo\tbar', 'foo\tbar');
test('execaCommand() allows escaping spaces', testExecaCommandOutput, 'foo\\ bar', 'foo bar');
test('execaCommand() allows escaping backslashes before spaces', testExecaCommandOutput, 'foo\\\\ bar', 'foo\\ bar');
test('execaCommand() allows escaping multiple backslashes before spaces', testExecaCommandOutput, 'foo\\\\\\\\ bar', 'foo\\\\\\ bar');
test('execaCommand() allows escaping backslashes not before spaces', testExecaCommandOutput, 'foo\\bar baz', 'foo\\bar\nbaz');

const testInvalidArgumentsArray = (t, execaMethod) => {
	t.throws(() => {
		execaMethod('echo', ['foo']);
	}, {message: /The command and its arguments must be passed as a single string/});
};

test('execaCommand() must not pass an array of arguments', testInvalidArgumentsArray, execaCommand);
test('execaCommandSync() must not pass an array of arguments', testInvalidArgumentsArray, execaCommandSync);

const testInvalidArgumentsTemplate = (t, execaMethod) => {
	t.throws(() => {
		// eslint-disable-next-line no-unused-expressions
		execaMethod`echo foo`;
	}, {message: /The command and its arguments must be passed as a single string/});
};

test('execaCommand() must not pass an array of arguments with a template string', testInvalidArgumentsTemplate, execaCommand);
test('execaCommandSync() must not pass an array of arguments with a template string', testInvalidArgumentsTemplate, execaCommandSync);