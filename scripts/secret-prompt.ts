import { createInterface } from "node:readline";

/**
 * Read a secret from the environment, or — when run in an interactive terminal
 * and the env var is unset — prompt for it with the typed characters masked, so
 * the value never reaches a command line, shell history, a file, or the agent.
 */
export async function resolveSecret(
  envName: string,
  label: string,
): Promise<string> {
  const fromEnv = process.env[envName]?.trim();
  if (fromEnv) return fromEnv;
  if (!process.stdin.isTTY) {
    throw new Error(
      `${envName} is not set and there is no interactive terminal to prompt from.`,
    );
  }
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  const masked = rl as unknown as {
    _writeToOutput: (value: string) => void;
    output: NodeJS.WriteStream;
  };
  let prompted = false;
  masked._writeToOutput = (value: string) => {
    if (!prompted) {
      masked.output.write(value);
      prompted = true;
    }
    // Swallow every echoed keystroke after the prompt itself.
  };
  return new Promise<string>((resolve) => {
    rl.question(`${label}: `, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}
