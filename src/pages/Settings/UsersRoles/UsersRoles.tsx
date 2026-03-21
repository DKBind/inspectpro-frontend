import { useEffect, useState } from 'react';
import { useForm, useController, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Shield, Loader2, Eye, Pencil, Trash2, Plus, UserCircle,
  Mail, Lock, User, ChevronDown, Wand2, AlertTriangle,
  Phone, FileText, Home, Package, Users,
} from 'lucide-react';

import { userService } from '@/services/userService';
import { useAuthStore } from '@/store/useAuthStore';
import { useModuleStore } from '@/store/useModuleStore';
import type {
  UserResponse, RoleResponse, RoleModuleAssignment, UserAddressRequest,
  ModuleResponse, RoleModulePermission, RoleUserItem,
} from '@/services/models/user';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/shared-ui/Dialog/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/shared-ui/DropdownMenu/dropdown-menu';
import { Button } from '@/components/shared-ui/Button/button';
import { Input } from '@/components/shared-ui/Input/input';
import Pagination from '@/components/shared-ui/Pagination/Pagination';
import styles from './UsersRoles.module.css';
import { Fld, IcoInput, inputCls } from '@/components/shared-ui/form-helpers';

// ─── Permission colours ────────────────────────────────────────────────────────
const PERM_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  All:    { bg: 'rgba(139,92,246,0.12)',  color: '#7c3aed', border: 'rgba(139,92,246,0.3)'  },
  Read:   { bg: 'rgba(34,197,94,0.12)',   color: '#16a34a', border: 'rgba(34,197,94,0.3)'   },
  Write:  { bg: 'rgba(59,130,246,0.12)',  color: '#2563eb', border: 'rgba(59,130,246,0.3)'  },
  Update: { bg: 'rgba(245,158,11,0.12)',  color: '#d97706', border: 'rgba(245,158,11,0.3)'  },
  Delete: { bg: 'rgba(239,68,68,0.12)',   color: '#dc2626', border: 'rgba(239,68,68,0.3)'   },
  Import: { bg: 'rgba(20,184,166,0.12)',  color: '#0d9488', border: 'rgba(20,184,166,0.3)'  },
  Export: { bg: 'rgba(99,102,241,0.12)',  color: '#4f46e5', border: 'rgba(99,102,241,0.3)'  },
  Share:  { bg: 'rgba(236,72,153,0.12)',  color: '#db2777', border: 'rgba(236,72,153,0.3)'  },
};
const permStyle = (name?: string) =>
  PERM_STYLE[name ?? ''] ?? { bg: 'rgba(107,114,128,0.10)', color: '#6b7280', border: 'rgba(107,114,128,0.25)' };

// All selectable permission names (shown in create/edit modal)
const ALL_PERM_NAMES = ['Read', 'Write', 'Update', 'Delete', 'Import', 'Export', 'Share'];

// ─── Group module assignments by moduleId ──────────────────────────────────────
const groupByModule = (mods: RoleModuleAssignment[]) => {
  const map = new Map<number, { moduleName: string; permissions: Set<string> }>();
  for (const m of mods) {
    if (!map.has(m.moduleId)) map.set(m.moduleId, { moduleName: m.moduleName, permissions: new Set() });
    if (m.permissionName) map.get(m.moduleId)!.permissions.add(m.permissionName);
  }
  return Array.from(map.entries()).map(([id, v]) => ({
    moduleId: id,
    moduleName: v.moduleName,
    permissions: Array.from(v.permissions),
  }));
};

// ─── User form schema ──────────────────────────────────────────────────────────
const schema = z.object({
  firstName:    z.string().min(1, 'First name is required'),
  middleName:   z.string().optional(),
  lastName:     z.string().min(1, 'Last name is required'),
  email:        z.string().email('Enter a valid email'),
  password:     z.string().optional(),
  phoneNumber:  z.string().optional(),
  gender:       z.string().optional(),
  bio:          z.string().optional(),
  remark:       z.string().optional(),
  roleId:       z.string().min(1, 'Role is required'),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  street:       z.string().optional(),
  district:     z.string().optional(),
  state:        z.string().optional(),
  country:      z.string().optional(),
  pincode:      z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  firstName: '', middleName: '', lastName: '', email: '', password: '',
  gender: '', bio: '', remark: '', roleId: '', phoneNumber: '',
  addressLine1: '', addressLine2: '', street: '', district: '',
  state: '', country: '', pincode: '',
};

const selectCls = (hasError = false) =>
  `w-full inline-flex items-center justify-between h-10 rounded-md border bg-white px-3 text-sm font-normal text-[#263B4F] hover:bg-[#F3F4F6] focus:outline-none transition-all ${hasError ? 'border-red-500' : 'border-[#E5E7EB]'}`;

const PAGE_SIZE = 10;
type SubTab = 'users' | 'roles';

// ─── Component ────────────────────────────────────────────────────────────────
const UsersRoles = () => {
  const { user: authUser } = useAuthStore();
  const { accessModules } = useModuleStore();
  const isSuperAdmin = authUser?.isSuperAdmin === true || authUser?.role === 'super_admin';

  const [subTab, setSubTab] = useState<SubTab>('users');

  // ── Users state ──────────────────────────────────────────────────────────
  const [users, setUsers]               = useState<UserResponse[]>([]);
  const [total, setTotal]               = useState(0);
  const [currentPage, setCurrentPage]   = useState(1);
  const [usersLoading, setUsersLoading] = useState(false);
  const [roles, setRoles]               = useState<RoleResponse[]>([]);
  const [modalMode, setModalMode]       = useState<'create' | 'edit' | null>(null);
  const [viewUser, setViewUser]         = useState<UserResponse | null>(null);
  const [editTarget, setEditTarget]     = useState<UserResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserResponse | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [toggleTarget, setToggleTarget] = useState<{ user: UserResponse; newActive: boolean } | null>(null);
  const [toggling, setToggling]         = useState(false);

  // ── Roles state ──────────────────────────────────────────────────────────
  const [roleList, setRoleList]           = useState<RoleResponse[]>([]);
  const [roleModules, setRoleModules]     = useState<Record<number, RoleModuleAssignment[]>>({});
  const [rolesLoading, setRolesLoading]   = useState(false);

  // Role create/edit modal
  const [roleModalOpen, setRoleModalOpen]       = useState(false);
  const [editRole, setEditRole]                 = useState<RoleResponse | null>(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<RoleResponse | null>(null);
  const [roleSubmitting, setRoleSubmitting]     = useState(false);
  const [roleDeletingId, setRoleDeletingId]     = useState<number | null>(null);
  const [roleToggling, setRoleToggling]         = useState<number | null>(null);
  const [toggleStatusTarget, setToggleStatusTarget] = useState<RoleResponse | null>(null);

  // Role form fields
  const [roleName, setRoleName]   = useState('');
  const [roleDesc, setRoleDesc]   = useState('');
  // scope is auto-determined by backend based on creator's context
  // moduleId → Set<permissionName>
  const [modPerms, setModPerms]   = useState<Map<number, Set<string>>>(new Map());

  // Available modules for the create/edit modal
  const [allModules, setAllModules]       = useState<ModuleResponse[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);

  // Modules detail modal (click on module count)
  const [modulesModalRole, setModulesModalRole] = useState<RoleResponse | null>(null);

  // Users detail modal (click on user count)
  const [usersModalRole, setUsersModalRole]       = useState<RoleResponse | null>(null);
  const [usersModalList, setUsersModalList]       = useState<RoleUserItem[]>([]);
  const [usersModalLoading, setUsersModalLoading] = useState(false);

  // ── User form ─────────────────────────────────────────────────────────────
  const methods = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { reset, handleSubmit, control, setValue, watch, register, formState: { errors } } = methods;

  const { field: firstNameField } = useController({ name: 'firstName', control });
  const { field: middleNameField } = useController({ name: 'middleName', control });
  const { field: lastNameField }  = useController({ name: 'lastName', control });
  const { field: emailField }     = useController({ name: 'email', control });
  const { field: passwordField }  = useController({ name: 'password', control });

  const selectedRoleId = watch('roleId');
  const selectedGender = watch('gender');
  const selectedRole   = roles.find((r) => String(r.roleId) === selectedRoleId);
  const totalPages     = Math.ceil(total / PAGE_SIZE);

  // ── Fetch users ───────────────────────────────────────────────────────────
  const fetchUsers = async (page = currentPage) => {
    setUsersLoading(true);
    try {
      const [userData, rolesData] = await Promise.all([
        userService.listUsers(page - 1, PAGE_SIZE),
        userService.listRoles(),
      ]);
      setUsers(userData.users);
      setTotal(userData.total);
      setRoles(rolesData);
    } catch { toast.error('Failed to load users'); }
    finally { setUsersLoading(false); }
  };

  useEffect(() => {
    if (subTab === 'users') fetchUsers(currentPage);
  }, [subTab, currentPage]);

  // ── Fetch roles ───────────────────────────────────────────────────────────
  const fetchRoles = async () => {
    setRolesLoading(true);
    try {
      const [fetched, withModules] = await Promise.all([
        userService.listRoles(),
        userService.listRolesWithModules(),
      ]);
      setRoleList(fetched);
      const entries: Record<number, RoleModuleAssignment[]> = {};
      for (const entry of withModules) {
        entries[entry.roleId] = entry.modules ?? [];
      }
      setRoleModules(entries);
    } catch { /* silent */ }
    finally { setRolesLoading(false); }
  };

  useEffect(() => {
    if (subTab === 'roles') fetchRoles();
  }, [subTab]);

  // ── Fetch modules for role modal ──────────────────────────────────────────
  const loadModalData = async () => {
    setModulesLoading(true);
    try {
      if (isSuperAdmin) {
        const mods = await userService.listModules();
        setAllModules(mods.filter((m) => m.active !== false));
      } else {
        // Non-admin: use the modules the logged-in user can access (always fresh from store)
        const mods = accessModules.map((m) => ({
          id: m.moduleId,
          name: m.name,
          route: m.route,
          active: true,
          category: m.category ?? null,
          icon: m.icon ?? null,
        } as ModuleResponse));
        if (mods.length > 0) {
          setAllModules(mods);
        } else {
          // Fallback: fetch from API if store is empty
          const fetched = await userService.listModules();
          setAllModules(fetched.filter((m) => m.active !== false));
        }
      }
    } catch { toast.error('Failed to load modules'); }
    finally { setModulesLoading(false); }
  };

  // ── Role modal helpers ────────────────────────────────────────────────────
  const openCreateRole = async () => {
    setEditRole(null);
    setRoleName('');
    setRoleDesc('');
    setModPerms(new Map());
    setRoleModalOpen(true);
    await loadModalData();
  };

  const openEditRole = async (role: RoleResponse) => {
    setEditRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description ?? '');
    const grouped = groupByModule(roleModules[role.roleId] ?? []);
    const map = new Map<number, Set<string>>();
    for (const g of grouped) map.set(g.moduleId, new Set(g.permissions));
    setModPerms(map);
    setRoleModalOpen(true);
    await loadModalData();
  };

  const closeRoleModal = () => { setRoleModalOpen(false); setEditRole(null); };

  // Module selection helpers
  const isModuleSelected = (moduleId: number) => modPerms.has(moduleId);
  const allModulesSelected = allModules.length > 0 && allModules.every((m) => {
    const perms = modPerms.get(m.id);
    return perms != null && ALL_PERM_NAMES.every((p) => perms.has(p));
  });

  const toggleModule = (moduleId: number) => {
    setModPerms((prev) => {
      const next = new Map(prev);
      if (next.has(moduleId)) { next.delete(moduleId); } else { next.set(moduleId, new Set()); }
      return next;
    });
  };

  const toggleAllModules = () => {
    if (allModulesSelected) {
      setModPerms(new Map());
    } else {
      // Select all modules with all permissions
      const next = new Map<number, Set<string>>();
      allModules.forEach((m) => {
        const full = new Set([...ALL_PERM_NAMES, 'All']);
        next.set(m.id, full);
      });
      setModPerms(next);
    }
  };

  const togglePermission = (moduleId: number, permName: string) => {
    setModPerms((prev) => {
      const next = new Map(prev);
      const perms = new Set(next.get(moduleId) ?? []);
      if (permName === 'All') {
        if (perms.has('All')) {
          ALL_PERM_NAMES.forEach((p) => perms.delete(p));
          perms.delete('All');
        } else {
          ALL_PERM_NAMES.forEach((p) => perms.add(p));
          perms.add('All');
          // Auto-select module when enabling All
          if (!next.has(moduleId)) next.set(moduleId, new Set());
        }
      } else {
        if (perms.has(permName)) {
          perms.delete(permName);
          perms.delete('All');
        } else {
          perms.add(permName);
          // Auto-select the module when adding a permission
          const allSelected = ALL_PERM_NAMES.every((p) => perms.has(p));
          allSelected ? perms.add('All') : perms.delete('All');
        }
      }
      next.set(moduleId, perms);
      return next;
    });
  };

  const toggleAllPermsForModule = (moduleId: number) => {
    setModPerms((prev) => {
      const next = new Map(prev);
      const perms = new Set(next.get(moduleId) ?? []);
      const allSelected = ALL_PERM_NAMES.every((p) => perms.has(p));
      if (allSelected) {
        // Clear all perms but keep module selected (empty set = selected, no perms)
        next.set(moduleId, new Set());
      } else {
        // Select all perms — also ensures module is selected
        const full = new Set(ALL_PERM_NAMES);
        full.add('All');
        next.set(moduleId, full);
      }
      return next;
    });
  };

  // Count individual perms (exclude 'All' pseudo-perm)
  const permCount = (moduleId: number) => {
    const perms = modPerms.get(moduleId) ?? new Set<string>();
    return ALL_PERM_NAMES.filter((p) => perms.has(p)).length;
  };

  // ── Submit role ───────────────────────────────────────────────────────────
  const submitRole = async () => {
    if (!roleName.trim()) { toast.error('Role name is required'); return; }
    setRoleSubmitting(true);
    try {
      const modules: RoleModulePermission[] = [];
      modPerms.forEach((perms, moduleId) => {
        const names = Array.from(perms);
        if (names.length > 0) modules.push({ moduleId, permissionNames: names });
      });
      const payload = { name: roleName.trim(), description: roleDesc.trim() || undefined, modules };
      if (editRole) {
        await userService.updateRole(editRole.roleId, payload);
        toast.success('Role updated successfully');
      } else {
        await userService.createRole(payload);
        toast.success('Role created successfully');
      }
      closeRoleModal();
      fetchRoles();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally { setRoleSubmitting(false); }
  };

  // ── Delete role ───────────────────────────────────────────────────────────
  const handleDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    setRoleDeletingId(deleteRoleTarget.roleId);
    try {
      await userService.deleteRole(deleteRoleTarget.roleId);
      toast.success('Role deleted');
      setDeleteRoleTarget(null);
      fetchRoles();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete role');
    } finally { setRoleDeletingId(null); }
  };

  // ── Toggle role status ────────────────────────────────────────────────────
  const handleToggleRoleStatus = async () => {
    if (!toggleStatusTarget) return;
    const role = toggleStatusTarget;
    setToggleStatusTarget(null);
    setRoleToggling(role.roleId);
    try {
      const updated = await userService.toggleRoleStatus(role.roleId);
      setRoleList((prev) => prev.map((r) => r.roleId === role.roleId ? { ...r, isActive: updated.isActive, statusName: updated.statusName } : r));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally { setRoleToggling(null); }
  };

  // ── Open modules modal ────────────────────────────────────────────────────
  const openModulesModal = (role: RoleResponse) => setModulesModalRole(role);

  // ── Open users modal ──────────────────────────────────────────────────────
  const openUsersModal = async (role: RoleResponse) => {
    setUsersModalRole(role);
    setUsersModalList([]);
    setUsersModalLoading(true);
    try {
      const list = await userService.getRoleUsers(role.roleId);
      setUsersModalList(list);
    } catch { toast.error('Failed to load users'); }
    finally { setUsersModalLoading(false); }
  };

  // ── User form helpers ─────────────────────────────────────────────────────
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    setValue('password', Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''));
  };

  const openCreate = () => { reset(EMPTY); setEditTarget(null); setModalMode('create'); };

  const openEdit = (u: UserResponse) => {
    reset({
      firstName: u.firstName, middleName: u.middleName ?? '', lastName: u.lastName,
      email: u.email, password: '', phoneNumber: u.phoneNumber ?? '', gender: u.gender ?? '',
      bio: u.bio ?? '', remark: u.remark ?? '',
      roleId: u.roleId ? String(u.roleId) : '',
      addressLine1: u.address?.addressLine1 ?? '',
      addressLine2: u.address?.addressLine2 ?? '',
      street: u.address?.street ?? '',
      district: u.address?.district ?? '',
      state: u.address?.state ?? '',
      country: u.address?.country ?? '',
      pincode: u.address?.pincode ?? '',
    });
    setEditTarget(u);
    setModalMode('edit');
  };

  const closeModal = () => { setModalMode(null); setEditTarget(null); reset(EMPTY); };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const addressFields: UserAddressRequest = {
        addressLine1: values.addressLine1?.trim() || undefined,
        addressLine2: values.addressLine2?.trim() || undefined,
        street:       values.street?.trim() || undefined,
        district:     values.district?.trim() || undefined,
        state:        values.state?.trim() || undefined,
        country:      values.country?.trim() || undefined,
        pincode:      values.pincode?.trim() || undefined,
      };
      const hasAddress = Object.values(addressFields).some(Boolean);
      const payload = {
        firstName: values.firstName,
        middleName: values.middleName?.trim() || undefined,
        lastName: values.lastName,
        email: values.email,
        ...(values.password?.trim() && { password: values.password.trim() }),
        phoneNumber: values.phoneNumber?.trim() || undefined,
        gender:  values.gender || undefined,
        bio:     values.bio?.trim() || undefined,
        remark:  values.remark?.trim() || undefined,
        address: hasAddress ? addressFields : undefined,
        roleId:  Number(values.roleId),
        statusId: 1,
        ...(!isSuperAdmin && authUser?.orgId ? { orgId: authUser.orgId } : {}),
      };
      if (modalMode === 'create') {
        await userService.createUser(payload);
        toast.success('User created successfully');
      } else if (editTarget) {
        await userService.updateUser(editTarget.id, { ...payload, statusId: editTarget.statusId ?? 1 });
        toast.success('User updated successfully');
      }
      closeModal();
      fetchUsers(currentPage);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await userService.deleteUser(deleteTarget.id);
      toast.success('User deleted');
      setDeleteTarget(null);
      fetchUsers(currentPage);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally { setDeleting(false); }
  };

  const handleToggleStatus = (u: UserResponse) => {
    const isCurrentlyActive = (u.statusId ?? 1) === 1;
    setToggleTarget({ user: u, newActive: !isCurrentlyActive });
  };

  const doToggleStatus = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      const { user: u, newActive } = toggleTarget;
      const newStatusId = newActive ? 1 : 2;
      await userService.updateUser(u.id, {
        firstName: u.firstName, lastName: u.lastName, email: u.email,
        gender: u.gender || undefined, orgId: u.orgId, roleId: u.roleId, statusId: newStatusId,
      });
      setUsers((prev) => prev.map((x) => x.id === u.id
        ? { ...x, statusId: newStatusId, statusName: newActive ? 'Active' : 'Inactive' } : x));
      toast.success(`User marked as ${newActive ? 'Active' : 'Inactive'}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    } finally { setToggling(false); setToggleTarget(null); }
  };

  // Backend already filters roleList by createdBy for non-admin users.
  const visibleRoles = roleList;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className={styles.usersRolesPage}>
      {/* Sub-tabs */}
      <div className={styles.subTabs}>
        <button className={`${styles.subTab} ${subTab === 'users' ? styles.subTabActive : ''}`} onClick={() => setSubTab('users')}>Users</button>
        <button className={`${styles.subTab} ${subTab === 'roles' ? styles.subTabActive : ''}`} onClick={() => setSubTab('roles')}>Roles &amp; Permissions</button>
      </div>

      {/* ── Users tab ────────────────────────────────────────────────────────── */}
      {subTab === 'users' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Team Members</h3>
            <button className={styles.addBtn} onClick={openCreate}>
              <Plus size={14} style={{ marginRight: 5 }} /> Add User
            </button>
          </div>

          {usersLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: '#9CA3AF' }} />
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 13.5 }}>
              No users found. Click "Add User" to create one.
            </div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Gender</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isActive = (u.statusId ?? 1) === 1;
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className={styles.userName}>
                            {[u.firstName, u.middleName, u.lastName].filter(Boolean).join(' ')}
                          </div>
                        </td>
                        <td className={styles.mutedCell}>
                          {u.phoneNumber
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Phone size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                                {u.phoneNumber}
                              </span>
                            : <span style={{ color: '#D1D5DB' }}>—</span>}
                        </td>
                        <td className={styles.mutedCell}>
                          {u.email
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Mail size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                                {u.email}
                              </span>
                            : <span style={{ color: '#D1D5DB' }}>—</span>}
                        </td>
                        <td className={styles.mutedCell}>
                          {u.gender ?? <span style={{ color: '#D1D5DB' }}>—</span>}
                        </td>
                        <td>
                          {u.roleName
                            ? <span className={styles.roleBadge}>{u.roleName}</span>
                            : <span style={{ color: '#D1D5DB', fontSize: 12.5 }}>—</span>}
                        </td>
                        <td>
                          <button
                            className={`${styles.statusToggle} ${isActive ? styles.toggleOn : styles.toggleOff}`}
                            onClick={() => handleToggleStatus(u)}
                            disabled={toggling}
                            title={isActive ? 'Click to deactivate' : 'Click to activate'}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                            <button className={styles.actionBtn} title="View" onClick={() => setViewUser(u)}><Eye size={13} /></button>
                            <button className={styles.actionBtn} title="Edit" onClick={() => openEdit(u)}><Pencil size={13} /></button>
                            <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="Delete" onClick={() => setDeleteTarget(u)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className={styles.paginationArea}>
                  <Pagination
                    currentPage={currentPage} totalPages={totalPages}
                    totalItems={total} pageSize={PAGE_SIZE} onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Roles tab ────────────────────────────────────────────────────────── */}
      {subTab === 'roles' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={15} style={{ color: '#33AE95' }} />
              Roles &amp; Permissions
            </h3>
            <button className={styles.addBtn} onClick={openCreateRole}>
              <Plus size={14} style={{ marginRight: 5 }} /> Create Role
            </button>
          </div>

          {rolesLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 24px', gap: 12 }}>
              <Loader2 size={28} style={{ color: '#33AE95', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13, color: '#9CA3AF' }}>Loading roles…</span>
            </div>
          ) : visibleRoles.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 24px', gap: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(51,174,149,0.10)', border: '1px solid rgba(51,174,149,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={24} style={{ color: '#33AE95', opacity: 0.7 }} />
              </div>
              <span style={{ fontSize: 13.5, color: '#6B7280' }}>No roles yet. Click "Create Role" to add one.</span>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Role Name</th>
                  <th>Assigned Users</th>
                  <th>Modules</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'center', width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRoles.map((role) => {
                  const grouped  = groupByModule(roleModules[role.roleId] ?? []);
                  const isActive = role.isActive !== false;
                  return (
                    <tr key={role.roleId} className={styles.tableRow}>
                      {/* Role name */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(51,174,149,0.10)', border: '1px solid rgba(51,174,149,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Shield size={14} style={{ color: '#33AE95' }} />
                          </div>
                          <span className={styles.userName}>{role.name}</span>
                        </div>
                      </td>
                      {/* Assigned users — clickable */}
                      <td>
                        <button className={styles.countBtn} onClick={() => openUsersModal(role)}>
                          <Users size={12} style={{ opacity: 0.6 }} />
                          {role.assignedUsersCount ?? 0}
                        </button>
                      </td>
                      {/* Module count — clickable */}
                      <td>
                        <button className={styles.countBtn} onClick={() => openModulesModal(role)}>
                          <Package size={12} style={{ opacity: 0.6 }} />
                          {role.moduleCount ?? 0}
                        </button>
                      </td>
                      {/* Status toggle */}
                      <td>
                        <button
                          className={`${styles.statusToggle} ${isActive ? styles.toggleOn : styles.toggleOff}`}
                          onClick={() => setToggleStatusTarget(role)}
                          disabled={roleToggling === role.roleId}
                          title={isActive ? 'Click to deactivate' : 'Click to activate'}
                        />
                      </td>
                      {/* Created by */}
                      <td className={styles.mutedCell}>{role.createdByName ?? <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                      {/* Created date */}
                      <td className={styles.mutedCell}>{role.createdDate ?? <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                          <button className={styles.actionBtn} title="Edit" onClick={() => openEditRole(role)}>
                            <Pencil size={13} />
                          </button>
                          <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="Delete" onClick={() => setDeleteRoleTarget(role)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Modules Detail Modal ──────────────────────────────────────────────── */}
      <Dialog open={!!modulesModalRole} onOpenChange={(open) => !open && setModulesModalRole(null)}>
        <DialogContent className="sm:max-w-lg shadow-xl rounded-2xl p-0 max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="px-7 pt-7 pb-4 border-b border-[#E5E7EB] shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(51,174,149,0.12)', border: '1px solid rgba(51,174,149,0.3)' }}>
                <Package size={16} style={{ color: '#33AE95' }} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#263B4F]">Module Permissions</DialogTitle>
                <DialogDescription className="text-xs text-[#9CA3AF] mt-0.5">{modulesModalRole?.name}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-7 py-4">
            {modulesModalRole && (() => {
              const grouped = groupByModule(roleModules[modulesModalRole.roleId] ?? []);
              return grouped.length === 0
                ? <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>No modules assigned.</p>
                : grouped.map((m) => (
                    <div key={m.moduleId} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#33AE95', display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#263B4F' }}>{m.moduleName}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 14 }}>
                        {m.permissions.map((p) => {
                          const ps = permStyle(p);
                          return (
                            <span key={p} className={styles.permChip}
                              style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>
                              {p}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ));
            })()}
          </div>
          <DialogFooter className="px-7 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-2xl shrink-0">
            <Button variant="ghost" onClick={() => setModulesModalRole(null)}
              className="text-[#6B7280] hover:text-[#263B4F] hover:bg-white border border-[#E5E7EB]">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Users Detail Modal ────────────────────────────────────────────────── */}
      <Dialog open={!!usersModalRole} onOpenChange={(open) => !open && setUsersModalRole(null)}>
        <DialogContent className="sm:max-w-md shadow-xl rounded-2xl p-0 max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="px-7 pt-7 pb-4 border-b border-[#E5E7EB] shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-blue-600/15 border border-blue-500/25">
                <Users size={16} className="text-blue-500" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#263B4F]">Assigned Users</DialogTitle>
                <DialogDescription className="text-xs text-[#9CA3AF] mt-0.5">{usersModalRole?.name}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-4 py-3">
            {usersModalLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                <Loader2 size={20} style={{ color: '#33AE95', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : usersModalList.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>No users assigned to this role.</p>
            ) : (
              usersModalList.map((u) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserCircle size={16} style={{ color: '#3b82f6' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#263B4F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.firstName} {u.lastName}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                      <Mail size={10} style={{ opacity: 0.6 }} />{u.email}
                    </div>
                  </div>
                  {u.statusName && (
                    <span className={`${styles.statusBadge} ${u.statusName?.toLowerCase() === 'active' ? styles.statusActive : styles.statusInactive}`} style={{ fontSize: 10.5 }}>
                      {u.statusName}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
          <DialogFooter className="px-7 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-2xl shrink-0">
            <Button variant="ghost" onClick={() => setUsersModalRole(null)}
              className="text-[#6B7280] hover:text-[#263B4F] hover:bg-white border border-[#E5E7EB]">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create / Edit Role Modal ──────────────────────────────────────────── */}
      <Dialog open={roleModalOpen} onOpenChange={(open) => { if (!open) closeRoleModal(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(51,174,149,0.12)', border: '1px solid rgba(51,174,149,0.3)' }}>
                <Shield size={18} style={{ color: '#33AE95' }} />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">
                {editRole ? 'Edit Role' : 'Create Role'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] text-sm pl-12">
              {editRole ? 'Update the role details and module permissions.' : 'Define a new role and assign module-level permissions.'}
            </DialogDescription>
          </DialogHeader>

          <div className="px-7 py-6 space-y-5">
            {/* Role name */}
            <Fld label="Role Name" required>
              <Input
                placeholder="e.g. Manager"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                className={inputCls(!roleName.trim())}
              />
            </Fld>
            <Fld label="Description">
              <textarea
                rows={2}
                placeholder="Brief description of this role…"
                value={roleDesc}
                onChange={(e) => setRoleDesc(e.target.value)}
                className="w-full rounded-md bg-white border border-[#E5E7EB] text-[#263B4F] placeholder:text-[#9CA3AF] focus:border-[#33AE95] focus:ring-1 focus:ring-[#33AE95]/20 text-sm px-3 py-2 resize-none outline-none"
              />
            </Fld>

            {/* Module picker */}
            <div>
              <div className={styles.modulePickerHeader}>
                <span className={styles.modulePickerTitle}>
                  <Package size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                  Assign Modules &amp; Permissions
                </span>
                <button type="button" className={styles.selectAllBtn} onClick={toggleAllModules}>
                  {allModulesSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {modulesLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                  <Loader2 size={20} style={{ color: '#33AE95', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : (
                <div className={styles.modulePickerList}>
                  {allModules.map((mod) => {
                    const selected = isModuleSelected(mod.id);
                    const permsForMod = modPerms.get(mod.id) ?? new Set<string>();
                    const pc = permCount(mod.id);
                    return (
                      <div key={mod.id} className={`${styles.modulePickerItem} ${selected ? styles.modulePickerItemSelected : ''}`}>
                        {/* Module checkbox row */}
                        <label className={styles.moduleCheckRow}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleModule(mod.id)}
                            className={styles.moduleCheckbox}
                          />
                          <span className={styles.moduleCheckLabel}>
                            {mod.name}
                            {mod.category && <span className={styles.moduleCategoryTag}>{mod.category}</span>}
                          </span>
                          {selected && pc > 0 && (
                            <span className={styles.permCountBadge}>{pc} perm{pc !== 1 ? 's' : ''}</span>
                          )}
                        </label>

                        {/* Permission buttons — always visible */}
                        <div className={styles.permRow}>
                          <button
                            type="button"
                            className={`${styles.permBtn} ${ALL_PERM_NAMES.every((p) => permsForMod.has(p)) ? styles.permBtnActive : ''}`}
                            style={ALL_PERM_NAMES.every((p) => permsForMod.has(p))
                              ? { background: PERM_STYLE.All.bg, color: PERM_STYLE.All.color, borderColor: PERM_STYLE.All.border }
                              : {}}
                            onClick={() => toggleAllPermsForModule(mod.id)}
                          >All</button>
                          {ALL_PERM_NAMES.map((pName) => {
                            const active = permsForMod.has(pName);
                            const ps = permStyle(pName);
                            return (
                              <button
                                key={pName}
                                type="button"
                                className={`${styles.permBtn} ${active ? styles.permBtnActive : ''}`}
                                style={active ? { background: ps.bg, color: ps.color, borderColor: ps.border } : {}}
                                onClick={() => togglePermission(mod.id, pName)}
                              >{pName}</button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] bg-[#F3F4F6] rounded-b-2xl flex gap-3">
            <Button type="button" variant="ghost" onClick={closeRoleModal} disabled={roleSubmitting}
              className="text-[#6B7280] hover:text-[#263B4F] hover:bg-white border border-[#E5E7EB]">Cancel</Button>
            <Button onClick={submitRole} disabled={roleSubmitting}
              className="flex-1 sm:flex-none sm:min-w-44 font-semibold text-white shadow-md active:scale-95"
              style={{ background: '#33AE95' }}>
              {roleSubmitting
                ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{editRole ? 'Saving…' : 'Creating…'}</span>
                : editRole ? 'Save Changes' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Role Confirmation ──────────────────────────────────────────── */}
      <Dialog open={!!deleteRoleTarget} onOpenChange={(open) => !open && setDeleteRoleTarget(null)}>
        <DialogContent className="sm:max-w-md shadow-xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <DialogTitle className="text-[#263B4F]">Delete Role</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] pl-[52px]">
              Are you sure you want to delete <span className="text-[#263B4F] font-medium">{deleteRoleTarget?.name}</span>? Users assigned to this role will lose their permissions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-2">
            <Button variant="ghost" onClick={() => setDeleteRoleTarget(null)} disabled={roleDeletingId !== null}
              className="text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
            <Button onClick={handleDeleteRole} disabled={roleDeletingId !== null}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold min-w-28">
              {roleDeletingId !== null
                ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting…</span>
                : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Toggle Role Status Confirmation ──────────────────────────────────── */}
      <Dialog open={!!toggleStatusTarget} onOpenChange={(open) => !open && setToggleStatusTarget(null)}>
        <DialogContent className="sm:max-w-md shadow-xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${toggleStatusTarget?.isActive ? 'bg-orange-500/15 border border-orange-400/30' : 'bg-green-500/15 border border-green-400/30'}`}>
                <Shield size={18} className={toggleStatusTarget?.isActive ? 'text-orange-400' : 'text-green-400'} />
              </div>
              <DialogTitle className="text-[#263B4F]">
                {toggleStatusTarget?.isActive ? 'Deactivate Role' : 'Activate Role'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] pl-[52px]">
              Are you sure you want to {toggleStatusTarget?.isActive ? 'deactivate' : 'activate'} the role{' '}
              <span className="text-[#263B4F] font-medium">{toggleStatusTarget?.name}</span>?
              {toggleStatusTarget?.isActive
                ? ' Users assigned to this role will lose access until it is reactivated.'
                : ' Users assigned to this role will regain their access.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-2">
            <Button variant="ghost" onClick={() => setToggleStatusTarget(null)}
              className="text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
            <Button onClick={handleToggleRoleStatus}
              className={toggleStatusTarget?.isActive
                ? 'bg-orange-500 hover:bg-orange-400 text-white font-semibold min-w-28'
                : 'bg-green-600 hover:bg-green-500 text-white font-semibold min-w-28'}>
              {toggleStatusTarget?.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create / Edit User Modal ──────────────────────────────────────────── */}
      <Dialog open={modalMode !== null} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <UserCircle size={18} className="text-blue-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">
                {modalMode === 'create' ? 'Add User' : 'Edit User'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] text-sm pl-12">
              {modalMode === 'create' ? 'Fill in the details to create a new user.' : 'Update the user information below.'}
            </DialogDescription>
          </DialogHeader>

          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
              <div className="px-7 py-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Fld label="First Name" required error={errors.firstName?.message}>
                    <IcoInput icon={<User size={14} />}>
                      <Input placeholder="John" {...firstNameField} className={inputCls(!!errors.firstName)} />
                    </IcoInput>
                  </Fld>
                  <Fld label="Middle Name">
                    <IcoInput icon={<User size={14} />}>
                      <Input placeholder="A." {...middleNameField} className={inputCls(false)} />
                    </IcoInput>
                  </Fld>
                  <Fld label="Last Name" required error={errors.lastName?.message}>
                    <IcoInput icon={<User size={14} />}>
                      <Input placeholder="Doe" {...lastNameField} className={inputCls(!!errors.lastName)} />
                    </IcoInput>
                  </Fld>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Fld label="Email" required error={errors.email?.message}>
                    <IcoInput icon={<Mail size={14} />}>
                      <Input type="email" autoComplete="off" placeholder="john@example.com" {...emailField} className={inputCls(!!errors.email)} />
                    </IcoInput>
                  </Fld>
                  <Fld label={modalMode === 'create' ? 'Password' : 'New Password'}>
                    <div className="flex gap-2">
                      <IcoInput icon={<Lock size={14} />}>
                        <Input type="text" autoComplete="new-password"
                          placeholder={modalMode === 'create' ? 'Set a password' : 'Leave blank to keep current'}
                          {...passwordField} className={inputCls(false)} />
                      </IcoInput>
                      <button type="button" onClick={generatePassword} title="Generate password"
                        className="shrink-0 h-10 px-3 rounded-md border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#33AE95] hover:border-[#33AE95] transition-all flex items-center gap-1.5 text-xs font-medium">
                        <Wand2 size={13} />
                      </button>
                    </div>
                  </Fld>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Fld label="Phone Number">
                    <IcoInput icon={<Phone size={14} />}>
                      <Input type="tel" placeholder="+1 234 567 8900" {...register('phoneNumber')} className={inputCls(false)} />
                    </IcoInput>
                  </Fld>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Fld label="Gender">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger className={selectCls()}>
                        <span className={selectedGender ? 'text-[#263B4F]' : 'text-[#9CA3AF]'}>{selectedGender || '— Select —'}</span>
                        <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-white border-[#E5E7EB] text-[#263B4F] z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                        {['Male', 'Female', 'Other'].map((g) => (
                          <DropdownMenuItem key={g} onSelect={() => setValue('gender', g)} className="cursor-pointer focus:bg-[#F3F4F6] focus:text-[#263B4F] py-2.5">{g}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Fld>
                  <Fld label="Role" required error={errors.roleId?.message}>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger className={selectCls(!!errors.roleId)}>
                        <span className={selectedRole ? 'text-[#263B4F]' : 'text-[#9CA3AF]'}>{selectedRole ? selectedRole.name : '— Select —'}</span>
                        <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-white border-[#E5E7EB] text-[#263B4F] z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                        {roles.map((r) => (
                          <DropdownMenuItem key={r.roleId} onSelect={() => setValue('roleId', String(r.roleId), { shouldValidate: true })} className="cursor-pointer focus:bg-[#F3F4F6] focus:text-[#263B4F] py-2.5">{r.name}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Fld>
                </div>

                {/* Address section */}
                <div className={styles.addressSection}>
                  <div className={styles.addressSectionTitle}>
                    <Home size={13} />
                    Address
                    <span className={styles.addressSectionHint}>Optional</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Fld label="Address Line 1">
                      <Input placeholder="Building / Flat no." {...register('addressLine1')} className={inputCls(false)} />
                    </Fld>
                    <Fld label="Address Line 2">
                      <Input placeholder="Society / Colony" {...register('addressLine2')} className={inputCls(false)} />
                    </Fld>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 mt-3">
                    <Fld label="Street">
                      <Input placeholder="Street name" {...register('street')} className={inputCls(false)} />
                    </Fld>
                    <Fld label="District">
                      <Input placeholder="District" {...register('district')} className={inputCls(false)} />
                    </Fld>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 mt-3">
                    <Fld label="State">
                      <Input placeholder="State" {...register('state')} className={inputCls(false)} />
                    </Fld>
                    <Fld label="Country">
                      <Input placeholder="Country" {...register('country')} className={inputCls(false)} />
                    </Fld>
                    <Fld label="Pincode">
                      <Input placeholder="000000" {...register('pincode')} className={inputCls(false)} />
                    </Fld>
                  </div>
                </div>

                {/* Bio + Remark */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Fld label="Bio" hint="Optional">
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 pointer-events-none z-10"><FileText size={14} /></span>
                      <textarea rows={2} placeholder="Short bio…" {...register('bio')}
                        className="w-full rounded-md bg-white border border-[#E5E7EB] text-[#263B4F] placeholder:text-[#9CA3AF] focus:border-[#33AE95] focus:ring-1 focus:ring-[#33AE95]/20 text-sm px-3 py-2 pl-9 resize-none outline-none" />
                    </div>
                  </Fld>
                  <Fld label="Remark" hint="Optional">
                    <textarea rows={2} placeholder="Internal notes…" {...register('remark')}
                      className="w-full rounded-md bg-white border border-[#E5E7EB] text-[#263B4F] placeholder:text-[#9CA3AF] focus:border-[#33AE95] focus:ring-1 focus:ring-[#33AE95]/20 text-sm px-3 py-2 resize-none outline-none" />
                  </Fld>
                </div>
              </div>

              <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] bg-[#F3F4F6] rounded-b-2xl flex gap-3">
                <Button type="button" variant="ghost" onClick={closeModal} disabled={submitting}
                  className="text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
                <Button type="submit" disabled={submitting}
                  className="flex-1 sm:flex-none sm:min-w-44 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg active:scale-95">
                  {submitting
                    ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{modalMode === 'create' ? 'Creating...' : 'Saving...'}</span>
                    : modalMode === 'create' ? 'Create User' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      {/* ── View User Modal ────────────────────────────────────────────────────── */}
      <Dialog open={!!viewUser} onOpenChange={(open) => !open && setViewUser(null)}>
        <DialogContent className="sm:max-w-lg shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <UserCircle size={18} className="text-blue-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">User Details</DialogTitle>
            </div>
          </DialogHeader>
          {viewUser && (
            <div className="px-7 py-2 space-y-0">
              {([
                ['Full Name', [viewUser.firstName, viewUser.middleName, viewUser.lastName].filter(Boolean).join(' ')],
                ['Email', viewUser.email],
                ...(viewUser.phoneNumber ? [['Phone', viewUser.phoneNumber] as [string, string]] : []),
                ['Gender', viewUser.gender ?? '—'],
                ['Role', viewUser.roleName ?? '—'],
                ...(isSuperAdmin ? [['Organisation', viewUser.orgName ?? '—'] as [string, string]] : []),
                ['Status', viewUser.statusName ?? '—'],
                ...(viewUser.address ? [
                  ['Address', [
                    viewUser.address.addressLine1, viewUser.address.addressLine2,
                    viewUser.address.street, viewUser.address.district,
                    viewUser.address.state, viewUser.address.country,
                    viewUser.address.pincode,
                  ].filter(Boolean).join(', ')] as [string, string],
                ] : []),
                ...(viewUser.bio    ? [['Bio', viewUser.bio]       as [string, string]] : []),
                ...(viewUser.remark ? [['Remark', viewUser.remark] as [string, string]] : []),
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex gap-3 py-2.5 border-b border-[#E5E7EB] last:border-0">
                  <span className="text-[#9CA3AF] min-w-28 text-xs uppercase tracking-wide font-semibold pt-0.5">{label}</span>
                  <span className="text-[#263B4F] font-medium text-sm">{value}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] bg-[#F3F4F6] rounded-b-2xl">
            <Button variant="ghost" onClick={() => setViewUser(null)} className="text-[#6B7280] hover:text-[#263B4F] hover:bg-white border border-[#E5E7EB]">Close</Button>
            {viewUser && (
              <Button onClick={() => { openEdit(viewUser); setViewUser(null); }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                <Pencil size={13} className="mr-2" /> Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete User Modal ──────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md shadow-xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <DialogTitle className="text-[#263B4F]">Delete User</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] pl-[52px]">
              Are you sure you want to delete <span className="text-[#263B4F] font-medium">{deleteTarget?.firstName} {deleteTarget?.lastName}</span>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}
              className="text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
            <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-500 text-white font-semibold min-w-28">
              {deleting ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting...</span> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Status Toggle Confirmation ─────────────────────────────────────────── */}
      <Dialog open={!!toggleTarget} onOpenChange={(open) => !open && setToggleTarget(null)}>
        <DialogContent className="sm:max-w-md shadow-xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-yellow-600/15 border border-yellow-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-yellow-400" />
              </div>
              <DialogTitle className="text-[#263B4F]">Confirm Status Change</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] pl-[52px]">
              {toggleTarget?.newActive
                ? <>Activating <span className="text-[#263B4F] font-medium">{toggleTarget.user.firstName} {toggleTarget.user.lastName}</span> will restore their access. Proceed?</>
                : <>Deactivating <span className="text-[#263B4F] font-medium">{toggleTarget?.user.firstName} {toggleTarget?.user.lastName}</span> will remove their access. Proceed?</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-2">
            <Button variant="ghost" onClick={() => setToggleTarget(null)} disabled={toggling}
              className="text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
            <Button onClick={doToggleStatus} disabled={toggling}
              className={`text-white font-semibold min-w-28 ${toggleTarget?.newActive ? 'bg-green-600 hover:bg-green-500' : 'bg-yellow-600 hover:bg-yellow-500'}`}>
              {toggling
                ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Updating...</span>
                : toggleTarget?.newActive ? 'Activate' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersRoles;
