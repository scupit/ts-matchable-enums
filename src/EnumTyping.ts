export type EnumType = {
  [key in (string | number)]: string | number;
};

// NOTE: IMPORTANT! The type of the enum must be passed as the generic (using the form 'typeof EnumType').
// Otherwise this will fail due to matching the constructor of EnumType, which is just a normal object
// constructor and has no info about enum keys.
export type EnumValueTypes<T extends EnumType> = T[keyof T];
export type EnumKeyTypes<T extends EnumType> = keyof T;

export type EnumKeyAndValueTypes<T extends EnumType> = Array<EnumValueTypes<T> | EnumKeyTypes<T>>;
