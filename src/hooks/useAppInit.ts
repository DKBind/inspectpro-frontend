import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useModuleStore } from '@/store/useModuleStore';
import { userService } from '@/services/userService';
import { moduleService } from '@/services/moduleService';
import { decodeJwtPayload } from '@/lib/utils';

/**
 * Runs once on every page load (and after login) when a token exists but the
 * app data hasn't been loaded yet.
 *
 * Flow:
 *   1. Decode idToken → extract custom:userId
 *   2. Fetch GET /users/{id} and GET /my-access in parallel
 *   3. Populate user store + module store
 *   4. Set isAppReady = true
 */
export const useAppInit = () => {
  const { idToken, isAppReady, setUser, setAppReady } = useAuthStore();
  const { setAccessModules } = useModuleStore();
  const initRef = useRef(false);

  useEffect(() => {
    // No token — nothing to load, mark ready so login page renders
    if (!idToken) {
      setAppReady(true);
      initRef.current = false;
      return;
    }

    if (isAppReady || initRef.current) return;
    initRef.current = true;

    const init = async () => {
      try {
        const claims = decodeJwtPayload(idToken);
        const userId = (claims['custom:userId'] as string) || (claims['sub'] as string);

        if (!userId) {
          setAppReady(true);
          return;
        }

        const [userDetails, accessModules] = await Promise.all([
          userService.getUserById(userId),
          moduleService.getMyAccess(userId),
        ]);

        setUser({
          id: userDetails.id,
          email: userDetails.email,
          name: `${userDetails.firstName ?? ''} ${userDetails.lastName ?? ''}`.trim(),
          role: userDetails.roleName ?? '',
          roleId: userDetails.roleId,
          roles: [],
          orgId: userDetails.orgId,
          orgName: userDetails.orgName,
          isSuperAdmin: (claims['custom:isSuperAdmin'] as string) === 'true',
          imageUrl: userDetails.imageUrl ?? null,
        });

        setAccessModules(accessModules);
      } catch {
        // Non-fatal — still mark ready so the app doesn't hang
      } finally {
        setAppReady(true);
        initRef.current = false;
      }
    };

    init();
  }, [idToken, isAppReady]);
};
