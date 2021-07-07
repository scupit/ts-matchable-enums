import { EnumType } from "./EnumTyping.ts";

export function getEnumKey<T extends EnumType>(en: T, valueKey: number): string & keyof T {
  const val = en[valueKey] as keyof T | undefined;
  if (typeof val === "undefined") {
    throw ReferenceError(`enum Key for value ${valueKey} does not exist in the enum`);
  }
  else if (typeof val !== "string") {
    throw ReferenceError(`Invalid enum type used to retrieve key. Numeric value ${valueKey} retrieved an existing key which is not of type string.`)
  }

  return val;
}

export function getEnumValue<T extends EnumType>(en: T, valueKey: string): keyof T & number {
  const val = en[valueKey] as keyof T | undefined;
  if (typeof val === "undefined") {
    throw ReferenceError(`enum Value for key ${valueKey} does not exist in the enum`);
  }
  else if (typeof val !== "number") {
    throw ReferenceError(`Invalid enum type used to retrieve value. String key ${valueKey} retrieved an existing key which is not of type number.`)
  }

  return val;
}
