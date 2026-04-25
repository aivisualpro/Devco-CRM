import Link from 'next/link';

export default function ProtectedNotFound() {
    return (
        <div className="w-full h-full min-h-[50vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
            <h2 className="text-4xl font-black text-slate-800">404</h2>
            <p className="text-slate-500 font-medium">This record or page does not exist.</p>
            <Link
                href="/dashboard"
                className="px-6 py-2 bg-[#0F4C75] text-white rounded-md hover:bg-[#0b3c5d] font-bold transition-colors shadow mt-4 inline-block"
            >
                Back to Dashboard
            </Link>
        </div>
    );
}
