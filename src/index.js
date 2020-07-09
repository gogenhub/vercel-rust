const fs = require("fs");
const path = require("path");
const execa = require("execa");
const toml = require("toml");
const {
	glob,
	createLambda,
	debug,
	download,
	FileFsRef
} = require("@now/build-utils");
const { installRustAndFriends } = require("./install-rust");
const version = 3;

const codegenFlags = [
	"-C",
	"target-cpu=ivybridge",
	"-C",
	"target-feature=-aes,-avx,+fxsr,-popcnt,+sse,+sse2,-sse3,-sse4.1,-sse4.2,-ssse3,-xsave,-xsaveopt"
];

function getBinName(cargo, entrypoint) {
	let res = cargo.bin.find(item => item.path === entrypoint);
	if (!res) {
		throw Error(`Entry point '${entrypoint}' is not a binary.`);
	}

	return res.name;
}

async function build({
	files,
	entrypoint,
	workPath,
	meta
}) {
	let { isDev } = meta;
	await installRustAndFriends();
	await download(files, workPath, meta);
	const cargoPath = `${workPath}/Cargo.toml`;
	if (!fs.existsSync(cargoPath)) {
		throw Error("Cargo.toml not found in root dir.");
	}
	let cargo = toml.parse(fs.readFileSync(cargoPath));
	let binName = getBinName(cargo, entrypoint);
	const staticPath = `${workPath}/static`;
	let staticStats = fs.lstatSync(staticPath);

	if (!staticStats.isDirectory()) {
		throw Error("'static' exists but it is not a directory.");
	}

	const extraFiles = await glob("static/**", workPath);
	debug(`building binary '${binName}'...`);
	const { PATH, HOME, RUSTFLAGS } = process.env;
	const rustEnv = {
		...process.env,
		PATH: `${path.join(HOME, ".cargo/bin")}:${PATH}`,
		RUSTFLAGS: [RUSTFLAGS, ...codegenFlags]
			.filter(Boolean)
			.join(" ")
	};
	let res = await execa.command(`cargo build --bin ${binName} ${isDev ? "--verbose" : "--release"}`, {
		env: rustEnv,
		cwd: workPath,
		stdio: "inherit"
	});
	debug(`done building '${res}'`);

	let bin = `${workPath}/target/${isDev ? "debug" : "release"}/${binName}`;
	const lambda = await createLambda({
		files: {
			...extraFiles,
			bootstrap: new FileFsRef({ mode: 0o755, fsPath: bin })
		},
		handler: "bootstrap",
		runtime: "provided"
	});

	return { output: lambda };
}
module.exports = {
	version,
	build,
};