import { useFormContext, useController } from 'react-hook-form';
import { Building2, Mail, Phone, User, Globe, FileText, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function OrgDetailsForm() {
  const { control, register, formState: { errors } } = useFormContext();

  const { field: nameField } = useController({ name: 'name', control });
  const { field: emailField } = useController({ name: 'email', control });
  const { field: domainField } = useController({ name: 'domain', control });

  const inputCls = (hasError: boolean) => `h-10 ${hasError ? 'border-destructive' : ''}`;

  return (
    <div className="space-y-6">

      {/* Organisation Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> Organisation Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">

          <div className="space-y-2">
            <Label htmlFor="name">Organisation Name <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="name" placeholder="Acme Corp" {...nameField}
                className={`pl-9 ${inputCls(!!errors.name)}`} />
            </div>
            {errors.name && <p className="text-sm text-destructive">{errors.name.message as string}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Contact Email <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" placeholder="admin@acme.com" {...emailField}
                className={`pl-9 ${inputCls(!!errors.email)}`} />
            </div>
            {errors.email && <p className="text-sm text-destructive">{errors.email.message as string}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="phoneNumber" placeholder="+91 98765 43210" {...register('phoneNumber')}
                className={`pl-9 ${inputCls(!!errors.phoneNumber)}`} />
            </div>
            {errors.phoneNumber && <p className="text-sm text-destructive">{errors.phoneNumber.message as string}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactedPersonName">Contact Person</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="contactedPersonName" placeholder="John Doe" {...register('contactedPersonName')}
                className="pl-9" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="domain">Domain <span className="text-muted-foreground text-xs">(Optional)</span></Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="domain" placeholder="acme.com" {...domainField}
                className={`pl-9 ${inputCls(!!errors.domain)}`} />
            </div>
            {errors.domain && <p className="text-sm text-destructive">{errors.domain.message as string}</p>}
          </div>

        </CardContent>
      </Card>

      {/* Business Identifiers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Business Identifiers
            <span className="text-muted-foreground text-xs font-normal">(Optional)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">

          <div className="space-y-2">
            <Label htmlFor="gstin">GSTIN</Label>
            <Input id="gstin" placeholder="22AAAAA0000A1Z5" maxLength={15}
              {...register('gstin')} className={`uppercase ${inputCls(!!errors.gstin)}`} />
            {errors.gstin && <p className="text-sm text-destructive">{errors.gstin.message as string}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pan">PAN</Label>
            <Input id="pan" placeholder="ABCDE1234F" maxLength={10}
              {...register('pan')} className={`uppercase ${inputCls(!!errors.pan)}`} />
            {errors.pan && <p className="text-sm text-destructive">{errors.pan.message as string}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tan">TAN</Label>
            <Input id="tan" placeholder="ABCD12345E" maxLength={10}
              {...register('tan')} className={`uppercase ${inputCls(!!errors.tan)}`} />
            {errors.tan && <p className="text-sm text-destructive">{errors.tan.message as string}</p>}
          </div>

        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" /> Address
            <span className="text-muted-foreground text-xs font-normal">(Optional)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">

          <div className="space-y-2">
            <Label htmlFor="addressLine1">Address Line 1</Label>
            <Input id="addressLine1" placeholder="Flat / House no., Building name"
              {...register('address.addressLine1')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address Line 2</Label>
            <Input id="addressLine2" placeholder="Area, Colony, Locality"
              {...register('address.addressLine2')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="street">Street</Label>
            <Input id="street" placeholder="Street name" {...register('address.street')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="district">District</Label>
            <Input id="district" placeholder="District" {...register('address.district')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" placeholder="State" {...register('address.state')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" placeholder="Country" {...register('address.country')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pincode">Pincode</Label>
            <Input id="pincode" placeholder="110001" maxLength={6}
              {...register('address.pincode')}
              className={inputCls(!!(errors.address as any)?.pincode)} />
            {(errors.address as any)?.pincode && (
              <p className="text-sm text-destructive">{(errors.address as any).pincode.message}</p>
            )}
          </div>

        </CardContent>
      </Card>

    </div>
  );
}
