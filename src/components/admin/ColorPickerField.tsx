'use client'

import React from 'react'
import { FieldError, FieldLabel, useField } from '@payloadcms/ui'
import ColorPicker from '../ui/color-picker'

interface ColorPickerFieldProps {
  path: string
  field?: {
    label?: string
    required?: boolean
  }
  validate?: any
  label?: string
}

export const ColorPickerField: React.FC<ColorPickerFieldProps> = ({ field, path, validate, label }) => {
  const { value, setValue, showError, errorMessage } = useField<string>({ path, validate })

  const displayLabel = label || field?.label || 'Color'
  const isRequired = field?.required

  return (
    <div className={`field-type${showError ? ' error' : ''}`}>
      <FieldLabel label={displayLabel} required={isRequired} htmlFor={path} />
      <div className="twp">
        <ColorPicker color={value || '#000000'} setColor={(c) => setValue(c)} />
      </div>
      <FieldError showError={showError} message={errorMessage} />
    </div>
  )
}

export default ColorPickerField
