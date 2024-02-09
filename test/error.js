import process from 'node:process';
import test from 'ava';
import {execa, execaSync} from '../index.js';
import {setFixtureDir} from './helpers/fixtures-dir.js';
import {fullStdio, getStdio} from './helpers/stdio.js';
import {noopGenerator, outputObjectGenerator} from './helpers/generator.js';
import {foobarString} from './helpers/input.js';

const isWindows = process.platform === 'win32';

setFixtureDir();

const TIMEOUT_REGEXP = /timed out after/;

test('Return value properties are not missing and are ordered', async t => {
	const result = await execa('empty.js', {...fullStdio, all: true});
	t.deepEqual(Reflect.ownKeys(result), [
		'command',
		'escapedCommand',
		'cwd',
		'failed',
		'timedOut',
		'isCanceled',
		'isTerminated',
		'exitCode',
		'stdout',
		'stderr',
		'all',
		'stdio',
	]);
});

test('Error properties are not missing and are ordered', async t => {
	const error = await t.throwsAsync(execa('fail.js', {...fullStdio, all: true}));
	t.deepEqual(Reflect.ownKeys(error), [
		'stack',
		'message',
		'shortMessage',
		'originalMessage',
		'command',
		'escapedCommand',
		'cwd',
		'failed',
		'timedOut',
		'isCanceled',
		'isTerminated',
		'exitCode',
		'signal',
		'signalDescription',
		'stdout',
		'stderr',
		'all',
		'stdio',
	]);
});

const testEmptyErrorStdio = async (t, execaMethod) => {
	const {failed, stdout, stderr, stdio} = await execaMethod('fail.js', {reject: false});
	t.true(failed);
	t.is(stdout, '');
	t.is(stderr, '');
	t.deepEqual(stdio, [undefined, '', '']);
};

test('empty error.stdout/stderr/stdio', testEmptyErrorStdio, execa);
test('empty error.stdout/stderr/stdio - sync', testEmptyErrorStdio, execaSync);

const testUndefinedErrorStdio = async (t, execaMethod) => {
	const {stdout, stderr, stdio} = await execaMethod('empty.js', {stdio: 'ignore'});
	t.is(stdout, undefined);
	t.is(stderr, undefined);
	t.deepEqual(stdio, [undefined, undefined, undefined]);
};

test('undefined error.stdout/stderr/stdio', testUndefinedErrorStdio, execa);
test('undefined error.stdout/stderr/stdio - sync', testUndefinedErrorStdio, execaSync);

const testEmptyAll = async (t, options, expectedValue) => {
	const {all} = await t.throwsAsync(execa('fail.js', options));
	t.is(all, expectedValue);
};

test('empty error.all', testEmptyAll, {all: true}, '');
test('undefined error.all', testEmptyAll, {}, undefined);
test('ignored error.all', testEmptyAll, {all: true, stdio: 'ignore'}, undefined);

test('empty error.stdio[0] even with input', async t => {
	const {stdio} = await t.throwsAsync(execa('fail.js', {input: 'test'}));
	t.is(stdio[0], undefined);
});

// `error.code` is OS-specific here
const SPAWN_ERROR_CODES = new Set(['EINVAL', 'ENOTSUP', 'EPERM']);

test('stdout/stderr/stdio on process spawning errors', async t => {
	const {code, stdout, stderr, stdio} = await t.throwsAsync(execa('empty.js', {uid: -1}));
	t.true(SPAWN_ERROR_CODES.has(code));
	t.is(stdout, undefined);
	t.is(stderr, undefined);
	t.deepEqual(stdio, [undefined, undefined, undefined]);
});

test('stdout/stderr/all/stdio on process spawning errors - sync', t => {
	const {code, stdout, stderr, stdio} = t.throws(() => {
		execaSync('empty.js', {uid: -1});
	});
	t.true(SPAWN_ERROR_CODES.has(code));
	t.is(stdout, undefined);
	t.is(stderr, undefined);
	t.deepEqual(stdio, [undefined, undefined, undefined]);
});

const testErrorOutput = async (t, execaMethod) => {
	const {failed, stdout, stderr, stdio} = await execaMethod('echo-fail.js', {...fullStdio, reject: false});
	t.true(failed);
	t.is(stdout, 'stdout');
	t.is(stderr, 'stderr');
	t.deepEqual(stdio, [undefined, 'stdout', 'stderr', 'fd3']);
};

test('error.stdout/stderr/stdio is defined', testErrorOutput, execa);
test('error.stdout/stderr/stdio is defined - sync', testErrorOutput, execaSync);

test('exitCode is 0 on success', async t => {
	const {exitCode} = await execa('noop.js', ['foo']);
	t.is(exitCode, 0);
});

const testExitCode = async (t, number) => {
	const {exitCode} = await t.throwsAsync(
		execa('exit.js', [`${number}`]),
		{message: new RegExp(`failed with exit code ${number}`)},
	);
	t.is(exitCode, number);
};

test('exitCode is 2', testExitCode, 2);
test('exitCode is 3', testExitCode, 3);
test('exitCode is 4', testExitCode, 4);

test('error.message contains the command', async t => {
	await t.throwsAsync(execa('exit.js', ['2', 'foo', 'bar']), {message: /exit.js 2 foo bar/});
});

const testStdioMessage = async (t, encoding, all, objectMode) => {
	const {message} = await t.throwsAsync(execa('echo-fail.js', {...getStdio(1, noopGenerator(objectMode), 4), encoding, all}));
	const output = all ? 'stdout\nstderr' : 'stderr\n\nstdout';
	t.true(message.endsWith(`echo-fail.js\n\n${output}\n\nfd3`));
};

test('error.message contains stdout/stderr/stdio if available', testStdioMessage, 'utf8', false, false);
test('error.message contains stdout/stderr/stdio even with encoding "buffer"', testStdioMessage, 'buffer', false, false);
test('error.message contains all if available', testStdioMessage, 'utf8', true, false);
test('error.message contains all even with encoding "buffer"', testStdioMessage, 'buffer', true, false);
test('error.message contains stdout/stderr/stdio if available, objectMode', testStdioMessage, 'utf8', false, true);
test('error.message contains stdout/stderr/stdio even with encoding "buffer", objectMode', testStdioMessage, 'buffer', false, true);
test('error.message contains all if available, objectMode', testStdioMessage, 'utf8', true, true);
test('error.message contains all even with encoding "buffer", objectMode', testStdioMessage, 'buffer', true, true);

const testPartialIgnoreMessage = async (t, index, stdioOption, output) => {
	const {message} = await t.throwsAsync(execa('echo-fail.js', getStdio(index, stdioOption, 4)));
	t.true(message.endsWith(`echo-fail.js\n\n${output}\n\nfd3`));
};

test('error.message does not contain stdout if not available', testPartialIgnoreMessage, 1, 'ignore', 'stderr');
test('error.message does not contain stderr if not available', testPartialIgnoreMessage, 2, 'ignore', 'stdout');
test('error.message does not contain stdout if it is an object', testPartialIgnoreMessage, 1, outputObjectGenerator, 'stderr');
test('error.message does not contain stderr if it is an object', testPartialIgnoreMessage, 2, outputObjectGenerator, 'stdout');

const testFullIgnoreMessage = async (t, options, resultProperty) => {
	const {[resultProperty]: message} = await t.throwsAsync(execa('echo-fail.js', options));
	t.false(message.includes('stderr'));
	t.false(message.includes('stdout'));
	t.false(message.includes('fd3'));
};

test('error.message does not contain stdout/stderr/stdio if not available', testFullIgnoreMessage, {stdio: 'ignore'}, 'message');
test('error.shortMessage does not contain stdout/stderr/stdio', testFullIgnoreMessage, fullStdio, 'shortMessage');

const testErrorMessageConsistent = async (t, stdout) => {
	const {message} = await t.throwsAsync(execa('noop-both-fail.js', [stdout, 'stderr']));
	t.true(message.endsWith(`noop-both-fail.js ${stdout} stderr\n\nstderr\n\nstdout`));
};

test('error.message newlines are consistent - no newline', testErrorMessageConsistent, 'stdout');
test('error.message newlines are consistent - newline', testErrorMessageConsistent, 'stdout\n');

test('Original error.message is kept', async t => {
	const {originalMessage} = await t.throwsAsync(execa('noop.js', {uid: true}));
	t.is(originalMessage, 'The "options.uid" property must be int32. Received type boolean (true)');
});

test('failed is false on success', async t => {
	const {failed} = await execa('noop.js', ['foo']);
	t.false(failed);
});

test('failed is true on failure', async t => {
	const {failed} = await t.throwsAsync(execa('fail.js'));
	t.true(failed);
});

test('error.isTerminated is true if process was killed directly', async t => {
	const subprocess = execa('forever.js', {killSignal: 'SIGINT'});

	subprocess.kill();

	const {isTerminated, signal} = await t.throwsAsync(subprocess, {message: /was killed with SIGINT/});
	t.true(isTerminated);
	t.is(signal, 'SIGINT');
});

test('error.isTerminated is true if process was killed indirectly', async t => {
	const subprocess = execa('forever.js', {killSignal: 'SIGHUP'});

	process.kill(subprocess.pid, 'SIGINT');

	// `process.kill()` is emulated by Node.js on Windows
	if (isWindows) {
		const {isTerminated, signal} = await t.throwsAsync(subprocess, {message: /failed with exit code 1/});
		t.is(isTerminated, false);
		t.is(signal, undefined);
	} else {
		const {isTerminated, signal} = await t.throwsAsync(subprocess, {message: /was killed with SIGINT/});
		t.is(isTerminated, true);
		t.is(signal, 'SIGINT');
	}
});

test('result.isTerminated is false if not killed', async t => {
	const {isTerminated} = await execa('noop.js');
	t.false(isTerminated);
});

test('result.isTerminated is false if not killed and childProcess.kill() was called', async t => {
	const subprocess = execa('noop.js');
	subprocess.kill(0);
	t.true(subprocess.killed);
	const {isTerminated} = await subprocess;
	t.false(isTerminated);
});

test('result.isTerminated is false if not killed, in sync mode', t => {
	const {isTerminated} = execaSync('noop.js');
	t.false(isTerminated);
});

test('result.isTerminated is false on process error', async t => {
	const {isTerminated} = await t.throwsAsync(execa('wrong command'));
	t.false(isTerminated);
});

test('result.isTerminated is false on process error, in sync mode', t => {
	const {isTerminated} = t.throws(() => {
		execaSync('wrong command');
	});
	t.false(isTerminated);
});

if (!isWindows) {
	test('error.signal is SIGINT', async t => {
		const subprocess = execa('forever.js');

		process.kill(subprocess.pid, 'SIGINT');

		const {signal} = await t.throwsAsync(subprocess, {message: /was killed with SIGINT/});
		t.is(signal, 'SIGINT');
	});

	test('error.signalDescription is defined', async t => {
		const subprocess = execa('forever.js');

		process.kill(subprocess.pid, 'SIGINT');

		const {signalDescription} = await t.throwsAsync(subprocess, {message: /User interruption with CTRL-C/});
		t.is(signalDescription, 'User interruption with CTRL-C');
	});

	test('error.signal is SIGTERM', async t => {
		const subprocess = execa('forever.js');

		process.kill(subprocess.pid, 'SIGTERM');

		const {signal} = await t.throwsAsync(subprocess, {message: /was killed with SIGTERM/});
		t.is(signal, 'SIGTERM');
	});

	test('error.signal uses killSignal', async t => {
		const {signal} = await t.throwsAsync(execa('forever.js', {killSignal: 'SIGINT', timeout: 1, message: TIMEOUT_REGEXP}));
		t.is(signal, 'SIGINT');
	});

	test('exitCode is undefined on signal termination', async t => {
		const subprocess = execa('forever.js');

		process.kill(subprocess.pid);

		const {exitCode} = await t.throwsAsync(subprocess);
		t.is(exitCode, undefined);
	});
}

test('result.signal is undefined for successful execution', async t => {
	const {signal} = await execa('noop.js');
	t.is(signal, undefined);
});

test('result.signal is undefined if process failed, but was not killed', async t => {
	const {signal} = await t.throwsAsync(execa('fail.js'));
	t.is(signal, undefined);
});

test('result.signalDescription is undefined for successful execution', async t => {
	const {signalDescription} = await execa('noop.js');
	t.is(signalDescription, undefined);
});

test('error.code is undefined on success', async t => {
	const {code} = await execa('noop.js');
	t.is(code, undefined);
});

test('error.code is defined on failure if applicable', async t => {
	const {code} = await t.throwsAsync(execa('noop.js', {uid: true}));
	t.is(code, 'ERR_INVALID_ARG_TYPE');
});

const testUnusualError = async (t, error) => {
	const childProcess = execa('empty.js');
	childProcess.emit('error', error);
	const {message, originalMessage} = await t.throwsAsync(childProcess);
	t.true(message.includes(String(error)));
	t.is(originalMessage, String(error));
};

test('error instance can be null', testUnusualError, null);
test('error instance can be false', testUnusualError, false);
test('error instance can be a string', testUnusualError, 'test');
test('error instance can be a number', testUnusualError, 0);
test('error instance can be a BigInt', testUnusualError, 0n);
test('error instance can be a symbol', testUnusualError, Symbol('test'));
test('error instance can be a function', testUnusualError, () => {});
test('error instance can be an array', testUnusualError, ['test', 'test']);

test('error instance can be undefined', async t => {
	const childProcess = execa('empty.js');
	childProcess.emit('error');
	await t.throwsAsync(childProcess, {message: 'Command failed: empty.js'});
});

test('error instance can be a plain object', async t => {
	const childProcess = execa('empty.js');
	childProcess.emit('error', {message: foobarString});
	await t.throwsAsync(childProcess, {message: new RegExp(foobarString)});
});

const runAndFail = (t, fixtureName, argument, error) => {
	const childProcess = execa(fixtureName, [argument]);
	childProcess.emit('error', error);
	return t.throwsAsync(childProcess);
};

const testErrorCopy = async (t, getPreviousArgument) => {
	const fixtureName = 'empty.js';
	const argument = 'two';

	const previousArgument = await getPreviousArgument(t, fixtureName);
	const previousError = await runAndFail(t, fixtureName, 'foo', previousArgument);
	const error = await runAndFail(t, fixtureName, argument, previousError);
	const message = `Command failed: ${fixtureName} ${argument}\n${foobarString}`;

	t.not(error, previousError);
	t.is(error.command, `${fixtureName} ${argument}`);
	t.is(error.message, message);
	t.true(error.stack.includes(message));
	t.is(error.shortMessage, message);
	t.is(error.originalMessage, foobarString);
};

test('error instance can be shared', testErrorCopy, () => new Error(foobarString));
test('error string can be shared', testErrorCopy, () => foobarString);
test('error copy can be shared', testErrorCopy, (t, fixtureName) => runAndFail(t, fixtureName, 'bar', new Error(foobarString)));

const testErrorCopyProperty = async (t, propertyName, isCopied) => {
	const propertyValue = 'test';
	const initialError = new Error(foobarString);
	initialError[propertyName] = propertyValue;

	const previousError = await runAndFail(t, 'empty.js', 'foo', initialError);
	t.is(previousError, initialError);

	const error = await runAndFail(t, 'empty.js', 'bar', previousError);
	t.is(error[propertyName] === propertyValue, isCopied);
};

test('error.code can be copied', testErrorCopyProperty, 'code', true);
test('error.errno can be copied', testErrorCopyProperty, 'errno', true);
test('error.syscall can be copied', testErrorCopyProperty, 'syscall', true);
test('error.path can be copied', testErrorCopyProperty, 'path', true);
test('error.dest can be copied', testErrorCopyProperty, 'dest', true);
test('error.address can be copied', testErrorCopyProperty, 'address', true);
test('error.port can be copied', testErrorCopyProperty, 'port', true);
test('error.info can be copied', testErrorCopyProperty, 'info', true);
test('error.other cannot be copied', testErrorCopyProperty, 'other', false);
