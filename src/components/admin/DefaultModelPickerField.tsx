'use client'

import React from 'react'
import { FieldError, FieldLabel, useField, useFormFields } from '@payloadcms/ui'

type ModelEntry = {
  id?: string
  name?: string
  provider?: string
  enabled?: boolean
}

interface DefaultModelPickerFieldProps {
  path: string
  field?: { label?: string; required?: boolean }
}

export function DefaultModelPickerField({ field, path }: DefaultModelPickerFieldProps) {
  const { value, setValue, showError, errorMessage } = useField<string>({ path })

  // path is 'ai.defaultModel' — models live at 'ai.models'
  const modelsPath = path.replace('defaultModel', 'models')

  const models = useFormFields(([fields]) => {
    // Payload v3 stores array rows at flattened paths: ai.models.0.id, ai.models.1.name, …
    const result: ModelEntry[] = []
    let i = 0
    while (i < 100) {
      const idField = fields[`${modelsPath}.${i}.id`]
      if (idField === undefined) break
      result.push({
        id: idField.value as string,
        name: fields[`${modelsPath}.${i}.name`]?.value as string,
        provider: fields[`${modelsPath}.${i}.provider`]?.value as string,
        enabled: fields[`${modelsPath}.${i}.enabled`]?.value !== false,
      })
      i++
    }
    return result
  })

  const enabledModels = models.filter((m): m is ModelEntry & { id: string; name: string } =>
    typeof m.id === 'string' && !!m.id && m.enabled !== false,
  )

  const currentValid = !value || enabledModels.some((m) => m.id === value)

  return (
    <div className={`field-type${showError ? ' error' : ''}`}>
      <FieldLabel label={field?.label ?? 'Default Model'} required={field?.required} htmlFor={path} />
      <div className="twp">
        <select
          id={path}
          value={value ?? ''}
          onChange={(e) => setValue(e.target.value || undefined)}
          className="h-[40px] w-full rounded border px-3 text-sm border-[var(--theme-border-color)] bg-[var(--theme-elevation-50)] text-[var(--theme-text)] outline-none focus:border-[var(--theme-elevation-500)] transition-colors"
        >
          <option value="">— select a model —</option>
          {enabledModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.id}
            </option>
          ))}
        </select>

        {value && !currentValid && (
          <p className="mt-1.5 text-xs text-red-500">
            Warning: &quot;{value}&quot; is not in the enabled models list.
          </p>
        )}
        {enabledModels.length === 0 && (
          <p className="mt-1.5 text-xs opacity-50">
            Add models to the Available Models list below to enable selection.
          </p>
        )}
      </div>
      <FieldError showError={showError} message={errorMessage} />
    </div>
  )
}

export default DefaultModelPickerField
