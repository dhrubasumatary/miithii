import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';

export default function SignUpPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-radial pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(232,121,249,0.08),transparent_70%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-4">
        <SignUp
          appearance={{
            variables: {
              colorBackground: '#111111',
              colorPrimary: '#e879f9',
              borderRadius: '12px',
              fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
            },
            elements: {
              card: 'bg-[#111] border border-[#222] shadow-2xl',
              headerTitle: 'text-white font-semibold text-xl',
              headerSubtitle: 'text-[#737373]',
              formButtonPrimary:
                'bg-[#e879f9] text-black font-semibold hover:bg-[#d946ef] transition-colors rounded-xl',
              footerActionLink: 'text-[#e879f9] hover:underline text-sm',
              dividerLine: 'bg-[#222]',
              dividerText: 'text-[#737373]',
              socialButtonsBlockButton:
                'border border-[#222] bg-[#111] text-white hover:bg-[#1a1a1a] transition-colors rounded-xl',
              socialButtonsIconButton: 'bg-transparent',
              formFieldInput:
                'bg-[#1a1a1a] border border-[#222] text-white focus:border-[#e879f9] rounded-lg',
              formFieldLabel: 'text-[#a3a3a3] text-sm',
            },
          }}
        />

        <p className="mt-6 text-center text-sm text-[#525252]">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-[#e879f9] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}