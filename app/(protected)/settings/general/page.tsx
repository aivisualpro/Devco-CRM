import { redirect } from 'next/navigation';

export default function GeneralSettingsRedirect() {
    redirect('/settings/general/document-ids');
}
