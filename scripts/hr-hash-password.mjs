import bcrypt from "bcryptjs";

if (!process.stdin.isTTY || !process.stdin.setRawMode) {
  console.error("A private interactive terminal is required. Password input is never accepted as a command argument.");
  process.exit(1);
}

process.stdout.write("Enter a strong temporary HRMS password (input hidden): ");
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");
let password = "";
for await (const character of process.stdin) {
  if (character === "\u0003") process.exit(130);
  if (character === "\r" || character === "\n") break;
  if (character === "\u007f" || character === "\b") password = password.slice(0, -1);
  else password += character;
}
process.stdin.setRawMode(false);
process.stdin.pause();
process.stdout.write("\n");
if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
  console.error("Password must contain at least 12 characters with uppercase, lowercase, and a number.");
  process.exit(1);
}
console.info(await bcrypt.hash(password, 12));
password = "";
