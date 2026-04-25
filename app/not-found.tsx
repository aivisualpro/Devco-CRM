import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="w-full h-screen flex flex-col items-center justify-center p-8 text-center space-y-4">
            <h2 className="text-4xl font-black text-slate-800">404</h2>
            <p className="text-slate-500 font-medium text-lg">We couldn't find the page you were looking for.</p>
            <Link
                href="/"
                className="px-6 py-2 bg-[#0F4C75] text-white rounded-md hover:bg-[#0b3c5d] font-bold transition-colors shadow mt-4 block"
            >
                Return Home
            </Link>
        </div>
    );
}
