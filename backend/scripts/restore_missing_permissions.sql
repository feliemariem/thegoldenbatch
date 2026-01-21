-- Script to restore missing permissions for admins 33-43
-- This inserts all 16 permission types for each admin, defaulting to disabled (false)
-- ON CONFLICT preserves any existing enabled permissions

-- All permission types (must match ALL_PERMISSIONS in permissions.js)
-- Total: 16 permissions per admin

DO $$
DECLARE
    admin_id INT;
    perm TEXT;
    permissions TEXT[] := ARRAY[
        'invites_add',
        'invites_link',
        'invites_upload',
        'invites_export',
        'registered_export',
        'masterlist_edit',
        'masterlist_upload',
        'masterlist_export',
        'announcements_view',
        'announcements_send',
        'accounting_view',
        'accounting_edit',
        'accounting_export',
        'minutes_view',
        'minutes_edit',
        'messages_view'
    ];
BEGIN
    -- Loop through admins 33-43
    FOR admin_id IN 33..43 LOOP
        -- Loop through all permissions
        FOREACH perm IN ARRAY permissions LOOP
            -- Insert permission with default false, preserve existing if already set
            INSERT INTO permissions (admin_id, permission, enabled)
            VALUES (admin_id, perm, false)
            ON CONFLICT (admin_id, permission) DO NOTHING;
        END LOOP;

        RAISE NOTICE 'Restored permissions for admin_id: %', admin_id;
    END LOOP;
END $$;

-- Verify the results
SELECT
    admin_id,
    COUNT(*) as permission_count,
    COUNT(*) FILTER (WHERE enabled = true) as enabled_count
FROM permissions
WHERE admin_id BETWEEN 33 AND 43
GROUP BY admin_id
ORDER BY admin_id;

-- Show detailed permissions for verification
SELECT
    admin_id,
    permission,
    enabled
FROM permissions
WHERE admin_id BETWEEN 33 AND 43
ORDER BY admin_id, permission;
