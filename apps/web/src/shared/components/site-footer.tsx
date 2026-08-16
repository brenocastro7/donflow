import { cn } from '@/lib/utils';

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer
      className={cn(
        'relative z-[1] flex min-h-[4.25rem] items-center justify-center px-[clamp(1rem,3vw,2rem)] py-5 text-center',
        'border-t border-[rgba(200,154,75,0.14)] bg-[#080907] text-[rgba(224,218,205,0.58)]',
        compact &&
          'min-h-[3.6rem] bg-[rgba(8,9,7,0.96)] max-[860px]:pb-[calc(5.5rem+env(safe-area-inset-bottom))]',
      )}
    >
      <p className="m-0 text-[0.68rem] tracking-[0.04em]">
        © {new Date().getFullYear()} DonFlow. Todos os direitos reservados.
      </p>
    </footer>
  );
}
