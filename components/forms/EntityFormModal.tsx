'use client';

import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z, ZodType } from 'zod';
import { Modal, Button, Input, SearchableSelect, Switch } from '@/components/ui';
import { Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

export interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'multiselect' | 'date' | 'currency' | 'boolean';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  validation?: ZodType;
  defaultValue?: any;
  placeholder?: string;
  help?: string;
  width?: 'full' | 'half' | 'third';
}

interface EntityFormModalProps<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: FieldConfig[];
  initialData?: Partial<T>;
  onSubmit: (data: T) => Promise<void>;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export function EntityFormModal<T extends Record<string, any>>({
  open,
  onClose,
  title,
  fields,
  initialData,
  onSubmit,
  submitLabel = 'Save Changes',
  isSubmitting: externalIsSubmitting
}: EntityFormModalProps<T>) {
  const [internalIsSubmitting, setInternalIsSubmitting] = useState(false);
  const isSubmitting = externalIsSubmitting || internalIsSubmitting;

  // Dynamically build Zod schema
  const schema = React.useMemo(() => {
    const shape: Record<string, any> = {};
    fields.forEach(field => {
      if (field.validation) {
        shape[field.name] = field.validation;
      } else {
        let base: any;
        switch (field.type) {
          case 'number':
          case 'currency':
            base = z.coerce.number();
            break;
          case 'boolean':
            base = z.boolean();
            break;
          case 'multiselect':
            base = z.array(z.string());
            break;
          default:
            base = z.string();
        }
        
        if (field.required) {
          if (field.type === 'text' || field.type === 'textarea') {
            base = base.min(1, `${field.label} is required`);
          } else if (field.type === 'multiselect') {
            base = base.min(1, `Please select at least one ${field.label}`);
          } else if (field.type === 'select') {
            base = base.min(1, `Please select a ${field.label}`);
          }
        } else {
          base = base.optional().nullable();
        }
        shape[field.name] = base;
      }
    });
    return z.object(shape);
  }, [fields]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: React.useMemo(() => {
      const defaults: any = {};
      fields.forEach(f => {
        defaults[f.name] = initialData?.[f.name] ?? f.defaultValue ?? (f.type === 'boolean' ? false : f.type === 'multiselect' ? [] : '');
      });
      return defaults;
    }, [fields, initialData])
  });

  useEffect(() => {
    if (open) {
      const defaults: any = {};
      fields.forEach(f => {
        defaults[f.name] = initialData?.[f.name] ?? f.defaultValue ?? (f.type === 'boolean' ? false : f.type === 'multiselect' ? [] : '');
      });
      reset(defaults);
    }
  }, [open, initialData, fields, reset]);

  const handleClose = () => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const onFormSubmit = async (data: any) => {
    setInternalIsSubmitting(true);
    try {
      await onSubmit(data as T);
      reset();
    } catch (err) {
      console.error(err);
    } finally {
      setInternalIsSubmitting(false);
    }
  };

  const getColSpan = (width?: 'full' | 'half' | 'third') => {
    switch (width) {
      case 'full': return 'col-span-12';
      case 'half': return 'col-span-12 md:col-span-6';
      case 'third': return 'col-span-12 md:col-span-4';
      default: return 'col-span-12 md:col-span-6';
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      title={title}
      maxWidth="3xl"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit(onFormSubmit)} 
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              submitLabel
            )}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onFormSubmit)} className="py-4">
        <div className="grid grid-cols-12 gap-x-6 gap-y-6">
          {fields.map(field => (
            <div key={field.name} className={getColSpan(field.width)}>
              <Controller
                name={field.name}
                control={control}
                render={({ field: { onChange, value, onBlur, name } }) => {
                  const error = errors[name]?.message as string;

                  switch (field.type) {
                    case 'textarea':
                      return (
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700">{field.label}</label>
                          <Textarea
                            placeholder={field.placeholder}
                            value={value || ''}
                            onChange={onChange}
                            onBlur={onBlur}
                            className={error ? 'border-red-500 focus:ring-red-500' : ''}
                          />
                          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                        </div>
                      );
                    case 'select':
                    case 'multiselect':
                      return (
                        <div className="space-y-1.5">
                          <SearchableSelect
                            label={field.label}
                            placeholder={field.placeholder}
                            options={field.options || []}
                            multiple={field.type === 'multiselect'}
                            value={value}
                            onChange={onChange}
                            className={error ? 'border-red-500' : ''}
                          />
                          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                        </div>
                      );
                    case 'boolean':
                      return (
                        <div className="flex items-center justify-between py-2 border-b border-gray-50 h-full">
                          <div className="space-y-0.5">
                            <label className="text-sm font-medium text-gray-700">{field.label}</label>
                            {field.help && <p className="text-xs text-gray-500">{field.help}</p>}
                          </div>
                          <Switch
                            checked={!!value}
                            onCheckedChange={onChange}
                          />
                        </div>
                      );
                    case 'currency':
                      return (
                        <div className="space-y-1.5">
                           <Input
                            label={field.label}
                            type="number"
                            step="0.01"
                            placeholder={field.placeholder || '0.00'}
                            value={value ?? ''}
                            onChange={onChange}
                            onBlur={onBlur}
                            className={error ? 'border-red-500' : ''}
                          />
                          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                        </div>
                      );
                    default:
                      return (
                        <div className="space-y-1.5">
                          <Input
                            label={field.label}
                            type={field.type}
                            placeholder={field.placeholder}
                            value={value ?? ''}
                            onChange={onChange}
                            onBlur={onBlur}
                            className={error ? 'border-red-500' : ''}
                          />
                          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                        </div>
                      );
                  }
                }}
              />
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}
