import * as t from "./types"

// Maps variable names to values
type Env = {
    objects: Record<string, Value>
}

// Clones the environment
let cloneEnv = (env: Env) : Env => 
    ({objects: {...env.objects}})

// A function value.
type Closure = {
    body: t.Term,
    parameters: string[]
    env: Env
}

// A value is the result of the interpretation

type Value
    = { kind: "boolean", value: boolean }
    | { kind: "string", value: string }
    | { kind: "number", value: number }
    | { kind: "closure", value: Closure }
    | { kind: "tuple", fst: Value, snd: Value };

// Interpreter

let unimplemented = () : never => { 
    throw new Error("unimplemented yet") 
}

export let interpretFile = (file: t.File) : Value => {
    let env = { objects: {} }
    return interpret(file.expression, env)
}

let typeMismatch = (type: string) : never => {
    throw new Error(`not a ${type}`)
}

let assertInt = (value: Value) : number => 
    value.kind == "number" ? value.value : typeMismatch("int")

let assertTuple = (value: Value) : [Value, Value] => 
    value.kind == "tuple" ? [value.fst, value.snd] : typeMismatch("tuple")

let assertClosure = (value: Value) : Closure => 
    value.kind == "closure" ? value.value : typeMismatch("closure")

let assertBool = (value: Value) : boolean => 
    value.kind == "boolean" ? value.value : typeMismatch("closure")

let castToString = (value: Value) : string =>
    value.kind == "number" || value.kind == "string" ? value.value.toString() : typeMismatch("string or int") 

let isEqual = (left: Value, right: Value) : boolean => {
    if (left.kind == "number" && right.kind == "number") {
        return left.value == right.value
    } else if (left.kind == "string" && right.kind == "string") {
        return left.value == right.value
    } if (left.kind == "boolean" && right.kind == "boolean") {
        return left.value == right.value
    } else {
        return typeMismatch("number or string or boolean")
    }
}

let interpretBinary = (left: Value, right: Value, op: t.BinaryOp) : Value => {
    switch (op) {
        case "Add": {
            if (left.kind == "number" && right.kind == "number") {
                return { kind: "number", value: left.value + right.value }
            } else {
                let leftVal = castToString(left);
                let rightVal = castToString(right);
                return { kind: "string", value: leftVal + rightVal }
            }
        }
        case "Eq": {
            let value = isEqual(left, right);
            return { kind: "boolean", value }
        }
        case "Neq": {
            let value = !isEqual(left, right);
            return { kind: "boolean", value }
        }
        case "Sub": {
            let leftVal = assertInt(left);
            let rightVal = assertInt(right);
            return { kind: "number", value: leftVal - rightVal }
        }
        case "Mul": {
            let leftVal = assertInt(left);
            let rightVal = assertInt(right);
            return { kind: "number", value: leftVal * rightVal }
        }
        case "Div": {
            let leftVal = assertInt(left);
            let rightVal = assertInt(right);
            return { kind: "number", value: Math.floor(leftVal / rightVal) }
        }
        case "Rem": {
            let leftVal = assertInt(left);
            let rightVal = assertInt(right);
            return { kind: "number", value: Math.floor(leftVal % rightVal) }
        }
        case "Lt": {
            let leftVal = assertInt(left);
            let rightVal = assertInt(right);
            return { kind: "boolean", value: leftVal < rightVal }
        }
        case "Gt": {
            let leftVal = assertInt(left);
            let rightVal = assertInt(right);
            return { kind: "boolean", value: leftVal > rightVal }
        }
        case "Lte": {
            let leftVal = assertInt(left);
            let rightVal = assertInt(right);
            return { kind: "boolean", value: leftVal <= rightVal }
        }
        case "Gte": {
            let leftVal = assertInt(left);
            let rightVal = assertInt(right);
            return { kind: "boolean", value: leftVal >= rightVal }
        }
        case "And": {
            let leftVal = assertBool(left);
            let rightVal = assertBool(right);
            return { kind: "boolean", value: leftVal && rightVal }
        }
        case "Or": {
            let leftVal = assertBool(left);
            let rightVal = assertBool(right);
            return { kind: "boolean", value: leftVal || rightVal }
        }
    }
}

let showValue = (value: Value) : string => {
    switch (value.kind) {
        case "number": return value.value.toString()
        case "boolean": return value.value ? "true" : "false"
        case "string": return value.value
        case "closure": return "<#closure>"
        case "tuple": return `(${showValue(value.fst)},${showValue(value.snd)})`
    }
}

let interpret = (term: t.Term, env: Env) : Value => {
    switch (term.kind) {
        case "Str": {
            return { kind: "string", value: term.value }
        }
        case "Bool": {
            return { kind: "boolean", value: term.value }
        }
        case "Int": {
            return { kind: "number", value: term.value }
        }
        case "If": {
            let condition = interpret(term.condition, env)
            let boolean = assertBool(condition)
            return interpret(boolean ? term.then : term.otherwise, env)
        }
        case "Tuple": {
            let fst = interpret(term.first, env);
            let snd = interpret(term.second, env);
            return { kind: "tuple", fst, snd }
        }
        case "First": {
            let fst = interpret(term.value, env);
            return assertTuple(fst)[0]
        }
        case "Second": {
            let fst = interpret(term.value, env);
            return assertTuple(fst)[1]
        }
        case "Binary": {
            let left = interpret(term.lhs, env)
            let right = interpret(term.rhs, env)
            return interpretBinary(left, right, term.op)
        }
        case "Print": {
            let value = interpret(term.value, env);
            console.log(showValue(value))
            return value
        }
        case "Var": {
            let value = env.objects[term.text];
            if (value) {
                return value
            } else {
                throw new Error(`cannot find variable ${term.text}`)
            }
        }
        case "Let": {
            let newEnv = cloneEnv(env);
            let value = interpret(term.value, newEnv);
            newEnv.objects[term.name.text] = value;
            return interpret(term.next, newEnv)
        }
        case "Call": {
            let func = interpret(term.callee, env)
            let closure = assertClosure(func)

            if (closure.parameters.length != term.arguments.length) {
                throw new Error(`expected ${closure.parameters.length} arguments but instead got ${term.arguments.length}`)
            }

            let functionEnv = cloneEnv(closure.env);
            
            for (let i = 0; i < closure.parameters.length; i++) {
                functionEnv.objects[closure.parameters[i]] = interpret(term.arguments[i], env)
            }

            return interpret(closure.body, functionEnv)
        }
        case "Function": {
            return { 
                kind: "closure", 
                value: {
                    body: term.value,
                    env,
                    parameters: term.parameters.map(x => x.text)
                }
            }
        }
    }
}
