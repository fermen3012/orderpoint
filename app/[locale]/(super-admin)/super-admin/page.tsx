import { redirect } from 'next/navigation';

export default function SuperAdminPage() {
    // We can assume the locale is in the path already for Next.js 15 app router prefixing
    // but redirect from next/navigation doesn't know about it.
    // Let's use it properly.
    redirect('/es/super-admin/dashboard');
}
