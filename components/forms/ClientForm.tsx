"use client";

import React, { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { User, MapPin, Plus, Trash2 } from "lucide-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input, Button, SearchableSelect, Switch } from "@/components/ui";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  extension: z.string().optional().nullable(),
  type: z.string(),
  active: z.boolean(),
  primary: z.boolean(),
});

const addressSchema = z.object({
  address: z.string().min(1, "Address is required"),
  primary: z.boolean(),
});

export const clientFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1, "Company Name is required"),
  proposalWriter: z.string().optional().nullable(),
  status: z.string(),
  contacts: z.array(contactSchema).min(1, "At least one contact is required"),
  addresses: z.array(addressSchema).min(1, "At least one address is required"),
  businessAddress: z.string().optional(),
}).superRefine((data, ctx) => {
    // Validate contacts have a primary
    const hasPrimaryContact = data.contacts.some(c => c.primary || c.active);
    if (!hasPrimaryContact && data.contacts.length > 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please select a primary contact",
            path: ["contacts"]
        });
    }
    // Validate addresses have a primary
    const hasPrimaryAddress = data.addresses.some(a => a.primary);
    if (!hasPrimaryAddress && data.addresses.length > 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please select a primary address",
            path: ["addresses"]
        });
    }
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

interface Employee {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    email?: string;
}

interface ClientFormProps {
  initialData?: Partial<ClientFormValues>;
  employees: Employee[];
  onSubmit: (data: ClientFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

export function ClientForm({ initialData, employees, onSubmit, onCancel, isSubmitting = false }: ClientFormProps) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: "",
      proposalWriter: "",
      status: "Active",
      contacts: [],
      addresses: [],
      ...initialData,
    },
  });

  const {
    fields: contactFields,
    append: appendContact,
    remove: removeContact,
    update: updateContact
  } = useFieldArray({
    control: form.control,
    name: "contacts",
  });

  const {
    fields: addressFields,
    append: appendAddress,
    remove: removeAddress,
    update: updateAddress
  } = useFieldArray({
    control: form.control,
    name: "addresses",
  });

  useEffect(() => {
    if (initialData) {
        const parsedAddresses = (initialData.addresses || []).map(a => 
            typeof a === 'string' ? { address: a, primary: false } : { address: a.address || '', primary: !!a.primary }
        );
        if (parsedAddresses.length > 0 && !parsedAddresses.some(a => a.primary)) {
            parsedAddresses[0].primary = true;
        }

        form.reset({
            _id: initialData._id,
            name: initialData.name || "",
            proposalWriter: initialData.proposalWriter || "",
            status: initialData.status || "Active",
            businessAddress: initialData.businessAddress || "",
            contacts: initialData.contacts || [],
            addresses: parsedAddresses,
        });
    }
  }, [initialData, form]);

  const setPrimaryContact = (index: number) => {
    const contacts = form.getValues("contacts");
    contacts.forEach((_, i) => {
        updateContact(i, { ...contacts[i], active: i === index, primary: i === index });
    });
  };

  const setPrimaryAddress = (index: number) => {
    const addresses = form.getValues("addresses");
    addresses.forEach((_, i) => {
        updateAddress(i, { ...addresses[i], primary: i === index });
    });
    // Set the top-level businessAddress to this primary address
    form.setValue("businessAddress", addresses[index].address);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-8">
        
        {/* Top Row: Company Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter company name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="proposalWriter"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proposal Writer</FormLabel>
                <FormControl>
                  <SearchableSelect
                    label=""
                    value={field.value || ''}
                    onChange={field.onChange}
                    options={employees.map(e => ({
                        label: `${e.firstName} ${e.lastName}`,
                        value: e._id,
                        image: e.profilePicture,
                        initials: `${e.firstName?.[0] || ''}${e.lastName?.[0] || ''}`
                    }))}
                    placeholder="Select writer"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</FormLabel>
                <FormControl>
                    <div className="flex items-center gap-3 h-[42px] px-4 rounded-xl bg-slate-50 border border-slate-200">
                        <Switch
                            checked={field.value === 'Active'}
                            onCheckedChange={(checked) => field.onChange(checked ? 'Active' : 'Inactive')}
                        />
                        <span className={`text-sm font-bold ${field.value === 'Active' ? 'text-slate-900' : 'text-slate-400'}`}>
                            {field.value || 'Active'}
                        </span>
                    </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Contacts Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#0F4C75]" />
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Contacts *</h4>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => appendContact({ name: '', email: '', phone: '', extension: '', type: contactFields.length === 0 ? 'Main Contact' : 'Secondary Contact', active: contactFields.length === 0, primary: contactFields.length === 0 })}
              className="h-8 px-4 rounded-lg text-[10px] font-bold uppercase tracking-wider !bg-[#0F4C75] hover:!bg-[#0F4C75]/90 transition-all"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> ADD CONTACT
            </Button>
          </div>
          
          {form.formState.errors.contacts?.root && (
            <p className="text-[13px] font-medium text-red-500">{form.formState.errors.contacts.root.message}</p>
          )}

          <div className="flex flex-col gap-3">
            {contactFields.map((field, idx) => {
              const isActive = form.watch(`contacts.${idx}.active`);
              return (
                <div key={field.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/30 relative group shadow-sm transition-all hover:border-slate-300">
                    <button
                        type="button"
                        onClick={() => removeContact(idx)}
                        className="absolute top-3 right-3 text-slate-300 hover:text-red-500 transition-colors bg-white p-1.5 rounded-md border border-slate-100 shadow-sm opacity-0 group-hover:opacity-100"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-1">
                        <div className="md:col-span-3 flex flex-col gap-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Full Name</label>
                            <FormField
                                control={form.control}
                                name={`contacts.${idx}.name`}
                                render={({ field }) => (
                                    <FormControl>
                                        <Input placeholder="e.g. Tony Zeng" {...field} value={field.value || ''} className="h-10 bg-white border-slate-200 shadow-none text-sm font-medium" />
                                    </FormControl>
                                )}
                            />
                        </div>
                        <div className="md:col-span-3 flex flex-col gap-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Email</label>
                            <FormField
                                control={form.control}
                                name={`contacts.${idx}.email`}
                                render={({ field }) => (
                                    <FormControl>
                                        <Input placeholder="email@example.com" {...field} value={field.value || ''} className="h-10 bg-white border-slate-200 shadow-none text-sm" />
                                    </FormControl>
                                )}
                            />
                        </div>
                        <div className="md:col-span-2 flex flex-col gap-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Phone</label>
                            <FormField
                                control={form.control}
                                name={`contacts.${idx}.phone`}
                                render={({ field }) => (
                                    <FormControl>
                                        <Input 
                                            placeholder="(555) 000-0000" 
                                            {...field} 
                                            value={field.value || ''}
                                            onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                                            className="h-10 bg-white border-slate-200 shadow-none text-sm"
                                        />
                                    </FormControl>
                                )}
                            />
                        </div>
                        <div className="md:col-span-1 flex flex-col gap-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Ext</label>
                            <FormField
                                control={form.control}
                                name={`contacts.${idx}.extension`}
                                render={({ field }) => (
                                    <FormControl>
                                        <Input placeholder="123" {...field} value={field.value || ''} className="h-10 bg-white border-slate-200 shadow-none text-sm text-center" />
                                    </FormControl>
                                )}
                            />
                        </div>
                        <div className="md:col-span-3 flex flex-col gap-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Type & Status</label>
                            <div className="flex items-center gap-2">
                                <FormField
                                    control={form.control}
                                    name={`contacts.${idx}.type`}
                                    render={({ field }) => (
                                        <FormControl>
                                            <select 
                                                className="h-10 flex-1 px-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-[#3282B8] transition-all cursor-pointer shadow-none"
                                                value={field.value}
                                                onChange={field.onChange}
                                            >
                                                <option value="Main Contact">Main</option>
                                                <option value="Accounting">Acct</option>
                                                <option value="Secondary Contact">2nd</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </FormControl>
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => setPrimaryContact(idx)}
                                    className={`h-10 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${isActive ? 'bg-[#0F4C75] text-white border-[#0F4C75] shadow-md shadow-[#0F4C75]/20' : 'bg-transparent text-slate-400 border-transparent hover:text-[#0F4C75]'}`}
                                >
                                    {isActive ? 'Primary Active' : 'Set Primary'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
              );
            })}
            
            {contactFields.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <div className="text-slate-400 text-xs font-medium">No contacts added yet.</div>
                </div>
            )}
          </div>
        </div>

        {/* Addresses Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#0F4C75]" />
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Addresses *</h4>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => appendAddress({ address: '', primary: addressFields.length === 0 })}
              className="h-8 px-4 rounded-lg text-[10px] font-bold uppercase tracking-wider !bg-[#0F4C75] hover:!bg-[#0F4C75]/90 transition-all"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> ADD ADDRESS
            </Button>
          </div>
          
          {form.formState.errors.addresses?.root && (
            <p className="text-[13px] font-medium text-red-500">{form.formState.errors.addresses.root.message}</p>
          )}

          <div className="flex flex-col gap-3">
            {addressFields.map((field, idx) => {
              const isPrimary = form.watch(`addresses.${idx}.primary`);
              return (
                <div key={field.id} className={`p-4 rounded-2xl border transition-all ${isPrimary ? 'bg-emerald-50/20 border-emerald-100' : 'bg-slate-50/30 border-slate-200'} relative group`}>
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between mb-0.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                                {isPrimary ? 'Primary Address' : `Additional Address ${idx + 1}`}
                            </label>
                            {isPrimary && <span className="text-[8px] font-black text-[#00A97F] bg-[#00A97F]/10 px-2 py-0.5 rounded uppercase tracking-widest">Main Table Address</span>}
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <FormField
                                    control={form.control}
                                    name={`addresses.${idx}.address`}
                                    render={({ field }) => (
                                        <FormControl>
                                            <Input placeholder="Enter full address line..." {...field} className="h-10 bg-white border-slate-200 shadow-none text-sm" onChange={(e) => {
                                                field.onChange(e);
                                                if (isPrimary) {
                                                    form.setValue("businessAddress", e.target.value);
                                                }
                                            }} />
                                        </FormControl>
                                    )}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setPrimaryAddress(idx)}
                                className={`h-10 px-4 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${isPrimary ? 'bg-[#00A97F] text-white border-[#00A97F] shadow-md shadow-[#00A97F]/20' : 'bg-transparent text-slate-400 border-transparent hover:text-[#00A97F]'}`}
                            >
                                {isPrimary ? 'Primary' : 'Set Primary'}
                            </button>
                            <button
                                type="button"
                                onClick={() => removeAddress(idx)}
                                className="h-10 w-10 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors bg-white border border-slate-200 rounded-lg shadow-sm"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
              );
            })}
            
            {addressFields.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <div className="text-slate-400 text-xs font-medium">No addresses added yet.</div>
                </div>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Client'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
