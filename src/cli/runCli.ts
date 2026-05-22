export async function runCli<TResult>(command: () => Promise<TResult>): Promise<void> {
  try {
    const result = await command();
    if (result !== undefined) {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
