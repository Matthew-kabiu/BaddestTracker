import { Eye, EyeOff } from 'lucide-react'
import { type InputHTMLAttributes, useId, useState } from 'react'

import { Field, FieldError, FieldLabel } from '@/components/kit/field'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/kit/input-group'

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  error?: string
}

/** Password field with a show / hide toggle, from kit Field + InputGroup. Every auth password uses it. */
export function PasswordField({ label, error, id, ...rest }: PasswordFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [visible, setVisible] = useState(false)
  const toggleLabel = visible ? 'Hide password' : 'Show password'
  const Icon = visible ? EyeOff : Eye

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={inputId}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...rest}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            onClick={() => setVisible((v) => !v)}
            aria-label={toggleLabel}
            aria-pressed={visible}
            aria-controls={inputId}
            title={toggleLabel}
          >
            <Icon aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error && <FieldError id={`${inputId}-error`}>{error}</FieldError>}
    </Field>
  )
}
