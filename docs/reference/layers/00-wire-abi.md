# Layer 0 - Wire ABI / Layout IR

## Purpose

Define how bytes are laid out before any convenience API exists.

## Public API

This layer is represented by schema package ABI constants and compiler Layout
IR:

- scalar byte lengths and alignments
- struct `byteLength` and `alignment`
- field `offset`
- `Span32`, `Vector32`, and `pointer32` descriptors

## Guarantees

- layout is deterministic for a given accepted `.zeno.ts` schema
- unsupported TypeScript constructs fail before code generation
- alignment and descriptor shapes are validated before emission

## Non-Guarantees

- no schema evolution compatibility shim
- no object materialization
- no runtime allocation policy

## When To Use

Use this layer when reviewing binary compatibility, debugging offsets, or
writing tests that assert Layout IR directly.

## Lower Layer Dependency

None. This is the load-bearing byte layout layer.

## Tests / Witness

- `tests/compiler/snapshot.test.ts`
- `tests/abi-contract.test.ts`
