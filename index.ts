export type Either<E, T> = Left<E> | Right<T>;

const Either = {
    toString<E, T>(this: Either<E, T>) {
        return `(${this.type} ${this.value})`;
    },
};

export interface Right<T> {
    readonly type: 'right';
    readonly value: T;
}

export interface Left<E> {
    readonly type: 'left';
    readonly value: E;
}

function getPropertyDescriptor<E, T>(type: 'right', value: T): PropertyDescriptorMap;
function getPropertyDescriptor<E, T>(type: 'left', value: E): PropertyDescriptorMap;
function getPropertyDescriptor<E, T>(type: 'right' | 'left', value: E | T): PropertyDescriptorMap {
    return {
        type: {
            value: type,
            enumerable: true,
        },
        value: {
            value,
            enumerable: true,
        },
    };
}

export const Right = <E, T>(value: T): Either<E, T> => Object.freeze(Object.create(Either, getPropertyDescriptor<E, T>('right', value)) as Either<E, T>);

export const Left = <E, T>(value: E): Either<E, T> => Object.freeze(Object.create(Either, getPropertyDescriptor<E, T>('left', value)) as Either<E, T>);

export const isRight = <E, T>(value: Either<E, T>): value is Right<T> => value.type === 'right';
export const isLeft = <E, T>(value: Either<E, T>): value is Left<E> => value.type === 'left';

export const caseOf = <E, T, R>(actions: { right: (value: T) => R; left: (value: E) => R }) => (input: Either<E, T>) =>
    isRight(input)
        ? actions.right(input.value)
        : actions.left(input.value);

export const mapLeft = <E, E2>(selector: (leftValue: E) => E2) => <T>(input: Either<E, T>): Either<E2, T> => caseOf<E, T, Either<E2, T>>({
    right: Right,
    left: (leftValue) => Left(selector(leftValue)),
})(input);

export const toArray = <E, T>(input: Either<E, T>): T[] => caseOf<E, T, T[]>({
    right: (x) => [x],
    left: () => [],
})(input);

export enum TakeSingleError {
    Empty,
    MoreThanOne,
}

export const singleFromArray = <T>(input: ReadonlyArray<T>): Either<TakeSingleError, T> => {
    if (input.length === 0) {
        return Left(TakeSingleError.Empty);
    } else if (input.length > 1) {
        return Left(TakeSingleError.MoreThanOne);
    } else {
        return Right(input[0]);
    }
};

export enum TakeFirstError {
    Empty,
}

export const firstFromArray = <T>(input: ReadonlyArray<T>): Either<TakeFirstError, T> =>
    input.length > 0
        ? Right(input[0])
        : Left(TakeFirstError.Empty);

export const defaultTo = <E, T>(defaultValue: T) => (input: Either<E, T>): T => caseOf({
    right: (x: T) => x,
    left: () => defaultValue,
})(input);

export const getRightOrFail = <E, T>(input: Either<E, T>): T => caseOf({
    right: (x: T) => x,
    left: (e: E) => { throw new Error(`Tried to get right out of a left: ${e}`); },
})(input);
export const getLeftOrFail = <E, T>(input: Either<E, T>): E => caseOf({
    right: (t: T) => { throw new Error(`Tried to get left out of a right: ${t}`); },
    left: (e: E) => e,
})(input);

// Functor
export const map = <T, R>(selector: (value: T) => R) => <E>(input: Either<E, T>): Either<E, R> => caseOf<E, T, Either<E, R>>({
    right: (value) => Right(selector(value)),
    left: Left,
})(input);

export const flap = <E, T, R>(func: Either<E, (input: T) => R>) => (value: T): Either<E, R> => map<(input: T) => R, R>((f) => f(value))(func);

// Bifunctor
export const bimap = <E, T, ER, TR>(leftSelector: (value: E) => ER) => (rightSelector: (value: T) => TR) => (input: Either<E, T>): Either<ER, TR> => caseOf<E, T, Either<ER, TR>>({
    right: (value) => Right(rightSelector(value)),
    left: (value) => Left(leftSelector(value)),
})(input);

// Chain
export const chain = <E, T, R>(selector: (value: T) => Either<E, R>) => (input: Either<E, T>): Either<E, R> => caseOf<E, T, Either<E, R>>({
    right: selector,
    left: Left,
})(input);

// Alt
export const alt = <E, T>(a: Either<E, T>) => (b: Either<E, T>): Either<E, T> =>
    isRight(a)
        ? a
        : b;
export const altLazy = <E, T>(a: Either<E, T>) => (b: () => Either<E, T>): Either<E, T> =>
    isRight(a)
        ? a
        : b();

// Extend
export const extend = <E, T, R>(selector: (value: Either<E, T>) => R) => (input: Either<E, T>): Either<E, R> =>
    isRight(input)
        ? Right(selector(input))
        : Left(input.value);

// Apply
export const apply = <E, T, R>(func: Either<E, (value: T) => R>) => (value: Either<E, T>): Either<E, R> =>
    isRight(func)
        ? map<T, R>(func.value)(value)
        : Left(func.value);

export const lift2 = <E, T1, T2, R>(func: (t1: T1) => (t2: T2) => R) => (t1: Either<E, T1>) => (t2: Either<E, T2>): Either<E, R> => {
    if (isLeft(t1)) {
        return t1;
    }
    if (isLeft(t2)) {
        return t2;
    }
    return Right(func(t1.value)(t2.value));
};
export const lift3 = <E, T1, T2, T3, R>(func: (t1: T1) => (t2: T2) => (t3: T3) => R) => (t1: Either<E, T1>) => (t2: Either<E, T2>) => (t3: Either<E, T3>): Either<E, R> => {
    if (isLeft(t1)) {
        return t1;
    }
    if (isLeft(t2)) {
        return t2;
    }
    if (isLeft(t3)) {
        return t3;
    }
    return Right(func(t1.value)(t2.value)(t3.value));
};

export const applyFirst = <E, T1, T2>(first: Either<E, T1>) => (second: Either<E, T2>): Either<E, T1> => {
    if (isLeft(first)) {
        return first;
    }
    if (isLeft(second)) {
        return second;
    }
    return first;
};

export const applySecond = <E, T1, T2>(first: Either<E, T1>) => (second: Either<E, T2>): Either<E, T2> => {
    if (isLeft(first)) {
        return first;
    }
    if (isLeft(second)) {
        return second;
    }
    return second;
};

export type EitherProps<E, T extends object> = { [K in keyof T]: Either<E, T[K]> };

export const liftProps = <E, T extends object>(input: EitherProps<E, T>): Either<E, T> => {
    const _input: Record<string, Either<E, any>> = input as any;
    const result: Record<string, any> = {};
    for (const key of Object.keys(_input)) {
        const value = _input[key];
        if (isLeft(value)) {
            return value;
        } else {
            result[key] = value.value;
        }
    }
    return Right(result as T);
};

export const liftPropsCollect = <E, T extends object>(input: EitherProps<E, T>): Either<ReadonlyArray<E>, T> => {
    const _input: Record<string, Either<E, any>> = input as any;
    const result: Record<string, any> = {};
    const errors: E[] = [];
    for (const key of Object.keys(_input)) {
        const value = _input[key];
        if (isLeft(value)) {
            errors.push(value.value);
        } else if (errors.length === 0) {
            result[key] = value.value;
        }
    }
    return errors.length === 0
        ? Right(result as T)
        : Left(errors);
};

// Applicative
export const of = Right;
