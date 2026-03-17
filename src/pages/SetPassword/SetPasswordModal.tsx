/**
 * SetPasswordModal
 *
 * Shown automatically when a user logs in for the first time using the
 * default password ("InspectPro@123"). The user must set a new password
 * before they can access the application.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { userService } from '@/services/userService';
import { Fld } from '@/components/shared-ui/form-helpers';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/shared-ui/Dialog/dialog';
import { Input } from '@/components/shared-ui/Input/input';
import { Button } from '@/components/shared-ui/Button/button';

const SetPasswordModal = () => {
  const { isFirstLogin, setFirstLoginDone } = useAuthStore();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await userService.changePassword(newPassword);
      toast.success('Password updated successfully!');
      setFirstLoginDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isFirstLogin} onOpenChange={() => { /* forced — cannot close without setting password */ }}>
      <DialogContent
        className="sm:max-w-md !bg-[#0d1117] !border-slate-800 text-white shadow-2xl rounded-2xl p-0"
        // Prevent closing by clicking outside or pressing Escape
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-7 pt-7 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <KeyRound size={18} className="text-blue-400" />
            </div>
            <DialogTitle className="text-xl font-bold text-white">Set Your Password</DialogTitle>
          </div>
          <DialogDescription className="text-slate-400 text-sm pl-12">
            Welcome! For security, please set a new password before continuing.
            Your default password was <span className="text-slate-300 font-mono">InspectPro@123</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-7 py-6 space-y-4">

            <Fld label="New Password" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
                  <Lock size={14} />
                </span>
                <Input
                  type={showNew ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-10 bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 pl-9 pr-10"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Fld>

            <Fld label="Confirm Password" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
                  <Lock size={14} />
                </span>
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-10 bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 pl-9 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Fld>

            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          <DialogFooter className="px-7 py-5 border-t border-slate-800 bg-slate-900/30 rounded-b-2xl">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg active:scale-95"
            >
              {submitting
                ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Saving...</span>
                : 'Set Password & Continue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SetPasswordModal;
