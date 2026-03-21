import type { TextField } from 'payload'

export const colorField: TextField = {
  name: 'color',
  type: 'text',
  admin: {
    components: {
      Field: '@/components/admin/ColorPickerField#ColorPickerField',
    },
  },
}

export const bgColorField: TextField = {
  name: 'bgColor',
  type: 'text',
  label: 'Background Color',
  admin: {
    components: {
      Field: '@/components/admin/ColorPickerField#ColorPickerField',
    },
  },
}
