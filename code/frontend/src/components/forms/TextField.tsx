import { type InputHTMLAttributes, useId } from 'react'

import { Field, FieldError, FieldLabel } from '@/components/kit/field'
import { Input } from '@/components/kit/input'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

/** Labelled input with a screen-reader-linked error, from kit Field + Input. */
export function TextField({ label, error, id, ...rest }: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...rest}
      />
      {error && <FieldError id={`${inputId}-error`}>{error}</FieldError>}
    </Field>
  )
}
