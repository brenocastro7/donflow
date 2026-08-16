import { CalendarPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  buildAppointmentIcs,
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  downloadIcsFile,
  type CalendarEventInput,
} from '../features/appointments/calendar-export';
import { customerActionButton } from './customer-portal-styles';

type ExportToCalendarMenuProps = {
  appointment: {
    id: string;
    startsAt: string;
    endsAt: string;
    serviceNameSnapshot: string;
    barberProfile: { displayName: string };
  };
  shopAddress: string | null;
};

export function ExportToCalendarMenu({ appointment, shopAddress }: ExportToCalendarMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const event: CalendarEventInput = {
    uid: `${appointment.id}@donflow.example`,
    title: appointment.serviceNameSnapshot,
    description: `${appointment.serviceNameSnapshot} com ${appointment.barberProfile.displayName}`,
    location: shopAddress,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        className={customerActionButton}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex items-center gap-[0.4rem]">
          <CalendarPlus className="size-[0.9rem]" />
          Exportar
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-[calc(100%+0.4rem)] left-0 z-10 grid w-[13rem] gap-1 rounded-[0.5rem] border border-[rgba(214,170,91,0.28)] bg-[linear-gradient(145deg,#171813,#0d0e0c)] p-2 shadow-[0_1rem_2.5rem_rgba(0,0,0,0.55)]"
        >
          <button
            role="menuitem"
            type="button"
            className="cursor-pointer rounded-[0.35rem] border-0 bg-transparent px-[0.6rem] py-[0.5rem] text-left text-[0.68rem] text-[#d6aa5b] hover:bg-[rgba(214,170,91,0.1)]"
            onClick={() => {
              window.open(buildGoogleCalendarUrl(event), '_blank', 'noopener,noreferrer');
              setOpen(false);
            }}
          >
            Google Calendar
          </button>
          <button
            role="menuitem"
            type="button"
            className="cursor-pointer rounded-[0.35rem] border-0 bg-transparent px-[0.6rem] py-[0.5rem] text-left text-[0.68rem] text-[#d6aa5b] hover:bg-[rgba(214,170,91,0.1)]"
            onClick={() => {
              window.open(buildOutlookCalendarUrl(event), '_blank', 'noopener,noreferrer');
              setOpen(false);
            }}
          >
            Outlook
          </button>
          <button
            role="menuitem"
            type="button"
            className="cursor-pointer rounded-[0.35rem] border-0 bg-transparent px-[0.6rem] py-[0.5rem] text-left text-[0.68rem] text-[#d6aa5b] hover:bg-[rgba(214,170,91,0.1)]"
            onClick={() => {
              downloadIcsFile(`marcacao-${appointment.id}.ics`, buildAppointmentIcs(event));
              setOpen(false);
            }}
          >
            Transferir ficheiro (.ics)
          </button>
        </div>
      )}
    </div>
  );
}
