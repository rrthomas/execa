import {writeFileSync} from 'node:fs';
import {joinToString, joinToUint8Array, bufferToUint8Array, isUint8Array, concatUint8Arrays} from './uint-array.js';
import {getGenerators, runGeneratorsSync} from './generator.js';
import {FILE_TYPES} from './type.js';

// Apply `stdout`/`stderr` options, after spawning, in sync mode
export const transformOutputSync = (fileDescriptors, {output}, options) => {
	if (output === null) {
		return {output: Array.from({length: 3})};
	}

	const state = {};
	const transformedOutput = output.map((result, fdNumber) =>
		transformOutputResultSync({result, fileDescriptors, fdNumber, state}, options));
	return {output: transformedOutput, ...state};
};

const transformOutputResultSync = ({result, fileDescriptors, fdNumber, state}, {buffer, encoding, lines}) => {
	if (result === null) {
		return;
	}

	const {stdioItems, outputLines, objectMode} = fileDescriptors[fdNumber];
	const uint8ArrayResult = bufferToUint8Array(result);
	const generators = getGenerators(stdioItems);
	const chunks = runOutputGeneratorsSync([uint8ArrayResult], generators, state);
	const {serializedResult, finalResult} = serializeChunks({chunks, objectMode, outputLines, encoding, lines});
	const returnedResult = buffer ? finalResult : undefined;

	try {
		if (state.error === undefined) {
			writeToFiles(serializedResult, stdioItems);
		}

		return returnedResult;
	} catch (error) {
		state.error = error;
		return returnedResult;
	}
};

const runOutputGeneratorsSync = (chunks, generators, state) => {
	try {
		return runGeneratorsSync(chunks, generators);
	} catch (error) {
		state.error = error;
		return chunks;
	}
};

const serializeChunks = ({chunks, objectMode, outputLines, encoding, lines}) => {
	if (objectMode) {
		return {finalResult: chunks};
	}

	const serializedResult = encoding === 'buffer' ? joinToUint8Array(chunks) : joinToString(chunks, true);
	const finalResult = lines ? outputLines : serializedResult;
	return {serializedResult, finalResult};
};

const writeToFiles = (serializedResult, stdioItems) => {
	for (const {type, path} of stdioItems) {
		if (FILE_TYPES.has(type)) {
			writeFileSync(path, serializedResult);
		}
	}
};

export const getAllSync = ([, stdout, stderr], {all}) => {
	if (!all) {
		return;
	}

	if (stdout === undefined) {
		return stderr;
	}

	if (stderr === undefined) {
		return stdout;
	}

	if (Array.isArray(stdout)) {
		return Array.isArray(stderr) ? [...stdout, ...stderr] : [...stdout, stderr];
	}

	if (Array.isArray(stderr)) {
		return [stdout, ...stderr];
	}

	if (isUint8Array(stdout) && isUint8Array(stderr)) {
		return concatUint8Arrays([stdout, stderr]);
	}

	return `${stdout}${stderr}`;
};