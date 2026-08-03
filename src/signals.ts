export function sumNumericStrings(values: string[]): string {
  if (!values.length) return "0";
  if (!values.every((value) => /^\d+(?:\.\d+)?$/.test(value))) {
    return values[0] ?? "0";
  }

  const scale = Math.max(
    ...values.map((value) => value.split(".")[1]?.length ?? 0),
  );
  const total = values.reduce((sum, value) => {
    const [whole, fraction = ""] = value.split(".");
    const digits = `${whole}${fraction.padEnd(scale, "0")}`;
    return sum + BigInt(digits || "0");
  }, 0n);
  if (scale === 0) return total.toString();

  const digits = total.toString().padStart(scale + 1, "0");
  const whole = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
