const execa = require("execa");
const fs = require("fs");
const { debug } = require("@now/build-utils");

async function downloadRustToolchain() {
	debug("Downloading the rust toolchain");
	console.log("Downloading the rust toolchain");
	try {
		await execa.command("curl --tlsv1.2 -sSf https://sh.rustup.rs -o rust.sh");
		const installRes = await execa.command("sh rust.sh -y");
		console.log(installRes.stdout);
	} catch (err) {
		throw new Error(`Failed to install rust via rustup: ${err}`);
	}
}
async function installRustAndFriends() {
	debug("Checking rust version");
	console.log("Checking rust version");
	try {
		let { stdout } = await execa.command("rusatup -V");
		console.log(stdout);
		debug("Rust already exists");
	} catch (err) {
		await downloadRustToolchain();
	}
};
module.exports = {
	installRustAndFriends,
	execa
};