import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Clock3,
  Trash2,
  LoaderCircle,
  Pencil,
  Plus,
  Power,
  Scissors,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useStaffUser } from '../app/staff-context';
import type { BarberService } from '../features/appointments/appointments-api';
import { getAccessToken } from '../features/auth/auth-session';
import {
  createOwnService,
  deleteOwnService,
  getMasterServiceCatalog,
  getOwnServices,
  updateOwnService,
  type MasterCatalogService,
} from '../features/services/services-api';
import { ApiError } from '../lib/api/api-error';
import { useRole } from '../shared/hooks/use-role';
import { cn } from '@/lib/utils';

const heroBackButton =
  'grid size-[2.7rem] shrink-0 place-items-center rounded-full border border-[rgba(226,216,195,0.14)] bg-[rgba(17,18,15,0.8)]';
const heroEyebrow =
  'flex items-center gap-[0.45rem] text-[0.65rem] font-bold tracking-[0.16em] text-gold-light uppercase';
const sectionEyebrow = 'm-0 text-[0.65rem] font-bold tracking-[0.15em] text-gold-accent uppercase';
const goldButton =
  'flex min-h-[2.9rem] items-center justify-center gap-[0.55rem] rounded-lg border border-gold-accent bg-[linear-gradient(135deg,#e0b96f,#a87934)] px-[1.1rem] text-[0.76rem] font-bold text-[#17130d] disabled:opacity-60';
const goldToolbarButton = cn(goldButton, 'max-[700px]:w-[2.9rem] max-[700px]:px-0');
const dialogErrorClass =
  'rounded-[0.45rem] border border-[rgba(177,79,79,0.28)] bg-[rgba(145,57,57,0.1)] p-3 text-[0.7rem] text-[#e5a0a0]';
const serviceIcon =
  'grid size-[2.6rem] place-items-center rounded-full border border-[rgba(200,154,75,0.25)] bg-[rgba(200,154,75,0.08)] text-gold-light';
const dialogFooterButton =
  'flex min-h-[2.8rem] items-center justify-center gap-2 rounded-[0.45rem] border border-[rgba(226,216,195,0.14)] bg-[#0b0c0a] px-4 max-[700px]:w-full max-[700px]:min-w-0 max-[700px]:px-[0.65rem]';

const durationOptions = [15, 30, 45, 60, 75, 90, 105, 120];

function formatPrice(value: string | number) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value));
}

export function ServicesPage() {
  const user = useStaffUser();
  const { isBarber } = useRole(user.role);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = getAccessToken()!;
  const barberProfileId = user.barberProfileId;
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<BarberService | null>(null);
  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [price, setPrice] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const services = useQuery({
    queryKey: ['barber-services', barberProfileId, 'all'],
    queryFn: () => getOwnServices(accessToken, barberProfileId!),
    enabled: Boolean(barberProfileId),
  });

  const masterCatalog = useQuery({
    queryKey: ['master-service-catalog'],
    queryFn: () => getMasterServiceCatalog(accessToken),
    enabled: isBarber,
  });

  const adoption = useMutation({
    mutationFn: (service: MasterCatalogService) =>
      createOwnService(accessToken, {
        barberProfileId: barberProfileId!,
        sourceBarberServiceId: service.id,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['barber-services'] });
      setCatalogError(null);
    },
    onError: (error) =>
      setCatalogError(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível adicionar o serviço ao teu catálogo.',
      ),
  });

  const visibleServices = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-PT');
    if (!normalizedSearch) return services.data?.data ?? [];
    return (
      services.data?.data.filter((service) =>
        service.name.toLocaleLowerCase('pt-PT').includes(normalizedSearch),
      ) ?? []
    );
  }, [search, services.data?.data]);

  const availableMasterServices = useMemo(
    () =>
      masterCatalog.data?.data.filter(
        (catalogService) =>
          !services.data?.data.some(
            (ownService) =>
              ownService.sourceBarberServiceId === catalogService.id ||
              (!ownService.sourceBarberServiceId &&
                ownService.name.toLocaleLowerCase('pt-PT') ===
                  catalogService.name.toLocaleLowerCase('pt-PT') &&
                ownService.durationMinutes === catalogService.durationMinutes),
          ),
      ) ?? [],
    [masterCatalog.data?.data, services.data?.data],
  );

  const saveService = useMutation({
    mutationFn: () => {
      const input = {
        name: name.trim(),
        durationMinutes,
        price: Number(price.replace(',', '.')),
      };
      return editingService
        ? updateOwnService(accessToken, editingService.id, { ...input, isActive })
        : createOwnService(accessToken, { barberProfileId: barberProfileId!, ...input });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['barber-services'] });
      setEditingService(null);
      setName('');
      setDurationMinutes(30);
      setPrice('');
      setIsActive(true);
      setFormError(null);
      setFormOpen(false);
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível guardar o serviço.',
      );
    },
  });

  const deletion = useMutation({
    mutationFn: () => deleteOwnService(accessToken, editingService!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['barber-services'] });
      setDeleteConfirmation(false);
      setEditingService(null);
      setFormError(null);
      setFormOpen(false);
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Não foi possível eliminar o serviço.',
      );
    },
  });

  const openCreateForm = () => {
    setEditingService(null);
    setName('');
    setDurationMinutes(30);
    setPrice('');
    setIsActive(true);
    setFormError(null);
    setDeleteConfirmation(false);
    setFormOpen(true);
  };

  const openEditForm = (service: BarberService) => {
    setEditingService(service);
    setName(service.name);
    setDurationMinutes(service.durationMinutes);
    setPrice(String(service.price).replace('.', ','));
    setIsActive(service.isActive);
    setFormError(null);
    setDeleteConfirmation(false);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saveService.isPending || deletion.isPending) return;
    setFormOpen(false);
    setEditingService(null);
    setFormError(null);
    setDeleteConfirmation(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const numericPrice = Number(price.replace(',', '.'));
    if (!name.trim()) {
      setFormError('Introduz o nome do serviço.');
      return;
    }
    if (!durationMinutes) {
      setFormError('Seleciona a duração do serviço.');
      return;
    }
    if (price.trim() === '' || Number.isNaN(numericPrice) || numericPrice < 0) {
      setFormError('Introduz um valor válido para o serviço.');
      return;
    }
    saveService.mutate();
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_80%_0,rgba(161,112,45,0.1),transparent_28rem),#080907] text-text">
      <header className="relative min-h-[14rem] overflow-hidden border-b border-[rgba(226,216,195,0.1)] max-[700px]:min-h-[12rem]">
        <div className="absolute inset-0 bg-[image:var(--barbershop-cover-admin)] bg-top bg-cover bg-no-repeat saturate-[0.7]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,8,6,0.96),rgba(7,8,6,0.45)),linear-gradient(0deg,#080907,transparent_60%)]" />
        <div className="relative mx-auto flex w-[min(100%-2rem,72rem)] items-end gap-[1.2rem] py-12 pb-8">
          <button
            type="button"
            aria-label="Voltar à página anterior"
            onClick={() => navigate(-1)}
            className={heroBackButton}
          >
            <ArrowLeft />
          </button>
          <div>
            <span className={heroEyebrow}>
              <Sparkles size={14} /> Barbearia DonFlow
            </span>
            <h1 className="mt-[0.45rem] font-serif text-[clamp(3rem,7vw,5rem)] leading-[0.85]">
              Serviços
            </h1>
            <p className="mt-[0.7rem] text-[0.8rem] text-[#a4a69f]">
              Organiza o catálogo de serviços da tua agenda.
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto w-[min(100%-2rem,72rem)] py-8 pt-8 pb-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className={sectionEyebrow}>O teu catálogo</p>
            <h2 className="mt-[0.35rem] text-[1.35rem]">Serviços disponíveis</h2>
          </div>
          <button
            type="button"
            className={goldToolbarButton}
            onClick={openCreateForm}
            disabled={!barberProfileId}
          >
            <Plus size={18} /> <span className="max-[700px]:hidden">Novo serviço</span>
          </button>
        </div>

        <div className="mt-6 grid min-h-[3.2rem] grid-cols-[auto_1fr_auto] items-center gap-[0.7rem] rounded-[0.65rem] border border-[rgba(226,216,195,0.11)] bg-[#10110e] px-4 [&_svg]:text-[#6f726b]">
          <Search size={17} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar serviço..."
            aria-label="Pesquisar serviço"
            className="h-12 min-w-0 border-0 bg-transparent text-[0.78rem] text-text outline-0"
          />
          <span className="text-[0.68rem] text-[#71746c] max-[700px]:hidden">
            {visibleServices.length} serviços
          </span>
        </div>

        {isBarber && availableMasterServices.length ? (
          <section
            className="mt-4 rounded-xl border border-[rgba(200,154,75,0.22)] bg-[rgba(200,154,75,0.055)] p-4"
            aria-labelledby="master-catalog-title"
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="m-0 text-[0.62rem] font-bold tracking-[0.13em] text-gold-accent uppercase">
                  Catálogo partilhado
                </p>
                <h3 id="master-catalog-title" className="mt-[0.3rem] text-[0.95rem]">
                  Serviços disponíveis para adicionar
                </h3>
              </div>
              <span className="text-[0.65rem] text-[#777a72]">
                {availableMasterServices.length} opções
              </span>
            </div>
            {catalogError && <p className={cn(dialogErrorClass, 'mt-3')}>{catalogError}</p>}
            <div className="mt-[0.85rem] grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-[0.55rem]">
              {availableMasterServices.map((catalogService) => (
                <article
                  key={catalogService.id}
                  className="relative grid min-h-[4.2rem] grid-cols-[2.5rem_1fr_auto] items-center gap-[0.65rem] rounded-[0.55rem] border border-[rgba(226,216,195,0.09)] bg-[#10110e] p-[0.65rem]"
                >
                  <span className={cn(serviceIcon, 'static size-[2.35rem]')}>
                    <Scissors size={17} />
                  </span>
                  <div>
                    <strong className="block text-[0.75rem]">{catalogService.name}</strong>
                    <small className="mt-1 block text-[0.62rem] text-[#777a72]">
                      {catalogService.durationMinutes} min · {formatPrice(catalogService.price)}
                    </small>
                  </div>
                  <button
                    type="button"
                    disabled={adoption.isPending}
                    onClick={() => adoption.mutate(catalogService)}
                    className="min-h-[2.15rem] rounded-[0.4rem] border border-[rgba(211,167,91,0.35)] bg-[rgba(200,154,75,0.08)] px-[0.65rem] text-[0.62rem] text-gold-light disabled:cursor-default disabled:text-[#777a72] disabled:opacity-[0.58]"
                  >
                    Adicionar
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {!barberProfileId ? (
          <ServiceState
            title="Perfil de agenda necessário"
            description="Esta conta ainda não possui uma agenda própria para associar serviços."
          />
        ) : services.isLoading ? (
          <ServiceState
            loading
            title="A carregar serviços"
            description="Estamos a consultar o teu catálogo."
          />
        ) : services.isError ? (
          <ServiceState
            title="Não foi possível carregar os serviços"
            description="Confirma a ligação à API e tenta novamente."
          />
        ) : visibleServices.length === 0 ? (
          <ServiceState
            title={search ? 'Nenhum serviço encontrado' : 'Ainda não existem serviços'}
            description={
              search
                ? 'Altera a pesquisa para encontrar outro serviço.'
                : 'Cria o primeiro serviço para começar a receber marcações.'
            }
            action={
              !search ? (
                <button type="button" onClick={openCreateForm} className={goldButton}>
                  <Plus size={17} /> Criar primeiro serviço
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="mt-[0.8rem] overflow-hidden rounded-xl border border-[rgba(226,216,195,0.11)] bg-[#10110e]">
            <div className="grid grid-cols-[minmax(12rem,1fr)_7rem_6rem_5rem_6rem] items-center gap-4 border-b border-[rgba(226,216,195,0.08)] py-[0.8rem] pr-[1.1rem] pl-[4.5rem] text-[0.62rem] tracking-[0.1em] text-[#6f726b] uppercase max-[700px]:hidden">
              <span>Serviço</span>
              <span>Duração</span>
              <span>Valor</span>
              <span>Estado</span>
              <span>Ações</span>
            </div>
            {visibleServices.map((service) => (
              <article
                className="relative grid min-h-20 grid-cols-[minmax(12rem,1fr)_7rem_6rem_5rem_6rem] items-center gap-4 py-[0.8rem] pr-[1.1rem] pl-[4.5rem] not-first:border-t not-first:border-[rgba(226,216,195,0.07)] max-[700px]:grid-cols-[1fr_auto] max-[700px]:gap-2 max-[700px]:py-4 max-[700px]:pr-[0.8rem] max-[700px]:pl-[4.2rem]"
                key={service.id}
              >
                <span className={cn(serviceIcon, 'absolute left-4')}>
                  <Scissors size={18} />
                </span>
                <div>
                  <strong className="block text-[0.82rem]">{service.name}</strong>
                  <small className="mt-[0.3rem] block text-[0.66rem] text-[#777a72]">
                    {service.description ?? 'Serviço da Barbearia DonFlow'}
                  </small>
                </div>
                <span className="flex items-center gap-[0.4rem] text-[0.72rem] text-[#aaaca5] max-[700px]:col-start-1">
                  <Clock3 size={16} /> {service.durationMinutes} min
                </span>
                <strong className="text-[0.78rem] max-[700px]:col-start-2 max-[700px]:row-start-1">
                  {formatPrice(service.price)}
                </strong>
                <span
                  className={cn(
                    'w-fit rounded-2xl bg-[rgba(121,63,63,0.13)] px-[0.6rem] py-[0.35rem] text-[0.62rem] text-[#9b7a7a] max-[700px]:col-start-2 max-[700px]:row-start-2',
                    service.isActive && 'bg-[rgba(60,121,75,0.14)] text-[#7fc18f]',
                  )}
                >
                  {service.isActive ? 'Ativo' : 'Inativo'}
                </span>
                <button
                  className="inline-flex min-h-[2.2rem] cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.45rem] border border-[rgba(226,216,195,0.14)] bg-white/[0.025] px-[0.65rem] text-[0.66rem] text-[#cfcec7] hover:border-[rgba(211,167,91,0.55)] hover:text-gold-light max-[700px]:col-span-full max-[700px]:mt-1 max-[700px]:justify-self-start"
                  type="button"
                  onClick={() => openEditForm(service)}
                  aria-label={`Editar ${service.name}`}
                >
                  <Pencil size={15} /> Editar
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {formOpen && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-[rgba(0,0,0,0.78)] p-4 backdrop-blur-[6px]"
          role="presentation"
        >
          <section
            className="w-[min(100%,31rem)] overflow-hidden rounded-[0.9rem] border border-[rgba(226,216,195,0.14)] bg-panel shadow-[0_2rem_6rem_rgba(0,0,0,0.55)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-dialog-title"
          >
            <header className="flex items-center justify-between border-b border-[rgba(226,216,195,0.09)] p-[1.4rem]">
              <div>
                <p className={sectionEyebrow}>{editingService ? 'Editar serviço' : 'Novo serviço'}</p>
                <h2 id="service-dialog-title" className="mt-[0.35rem] font-serif text-[1.8rem]">
                  {editingService ? 'Atualizar serviço' : 'Adicionar ao catálogo'}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={closeForm}
                className={heroBackButton}
              >
                <X />
              </button>
            </header>

            <form onSubmit={submit} className="p-[1.4rem] max-[700px]:p-4">
              <label className="block text-[0.72rem] font-semibold text-[#cfcec7]">
                Nome do serviço
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={120}
                  placeholder="Ex.: Corte clássico"
                  autoFocus
                  className="mt-[0.55rem] min-h-12 w-full rounded-lg border border-[rgba(226,216,195,0.13)] bg-[#0b0c0a] px-[0.85rem] text-text outline-0 focus:border-[rgba(211,167,91,0.65)]"
                />
              </label>
              <div className="mt-4 grid grid-cols-2 gap-[0.8rem]">
                <label className="block text-[0.72rem] font-semibold text-[#cfcec7]">
                  Duração
                  <select
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(Number(event.target.value))}
                    className="mt-[0.55rem] min-h-12 w-full rounded-lg border border-[rgba(226,216,195,0.13)] bg-[#0b0c0a] px-[0.85rem] text-text outline-0 focus:border-[rgba(211,167,91,0.65)]"
                  >
                    {durationOptions.map((duration) => (
                      <option value={duration} key={duration}>
                        {duration} minutos
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[0.72rem] font-semibold text-[#cfcec7]">
                  Valor
                  <span className="relative block">
                    <span className="absolute top-[1.45rem] left-[0.85rem] z-[1] text-[#858880]">
                      €
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      placeholder="0,00"
                      className="mt-[0.55rem] min-h-12 w-full rounded-lg border border-[rgba(226,216,195,0.13)] bg-[#0b0c0a] py-0 pr-[0.85rem] pl-8 text-text outline-0 focus:border-[rgba(211,167,91,0.65)]"
                    />
                  </span>
                </label>
              </div>

              <p className="mt-4 mb-0 text-[0.68rem] leading-[1.5] text-[#777a72]">
                O valor é apenas informativo para o cliente e não representa uma cobrança.
              </p>

              {editingService && (
                <button
                  className={cn(
                    'mt-4 grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[0.55rem] border border-[rgba(177,79,79,0.28)] bg-[rgba(145,57,57,0.08)] p-[0.8rem] text-left text-[#d5a2a2]',
                    isActive && 'border-[rgba(83,154,99,0.3)] bg-[rgba(60,121,75,0.1)] text-[#8ac798]',
                  )}
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => setIsActive((current) => !current)}
                >
                  <Power size={17} />
                  <span>
                    <strong className="block text-[0.72rem]">
                      {isActive ? 'Serviço ativo' : 'Serviço inativo'}
                    </strong>
                    <small className="mt-[0.2rem] block text-[0.62rem] text-[#858880]">
                      {isActive
                        ? 'Disponível para novas marcações.'
                        : 'Oculto para novas marcações.'}
                    </small>
                  </span>
                  <span
                    className={cn(
                      'relative h-[1.2rem] w-9 rounded-2xl bg-[#402929]',
                      "after:absolute after:top-[0.15rem] after:left-[0.15rem] after:size-[0.9rem] after:rounded-full after:bg-[#d7cec0] after:transition-transform after:duration-[160ms] after:ease-in-out after:content-['']",
                      isActive && 'bg-[#356243] after:translate-x-[1.05rem]',
                    )}
                    aria-hidden="true"
                  />
                </button>
              )}

              {deleteConfirmation && (
                <div
                  className="mt-4 grid grid-cols-[auto_1fr] items-start gap-[0.7rem] rounded-[0.55rem] border border-[rgba(190,80,80,0.35)] bg-[rgba(145,57,57,0.1)] p-[0.85rem] text-[#e5a0a0]"
                  role="alert"
                >
                  <Trash2 size={18} />
                  <span>
                    <strong className="block text-[0.74rem]">Eliminar este serviço?</strong>
                    <small className="mt-[0.3rem] block text-[0.65rem] leading-[1.45] text-[#b89c9c]">
                      Esta ação é definitiva. Serviços com marcações associadas devem ser
                      desativados e não podem ser eliminados.
                    </small>
                  </span>
                </div>
              )}

              {formError && (
                <p className={cn(dialogErrorClass, 'mt-4')} role="alert">
                  {formError}
                </p>
              )}

              <footer className="mt-[1.3rem] flex justify-end gap-[0.6rem] max-[700px]:grid max-[700px]:grid-cols-2 max-[700px]:gap-[0.55rem] has-[.confirm-delete-btn]:max-[700px]:grid-cols-1">
                {editingService && !deleteConfirmation && (
                  <button
                    className={cn(
                      dialogFooterButton,
                      'mr-auto border-[rgba(190,80,80,0.32)] text-[#e5a0a0] max-[700px]:col-span-full max-[700px]:mr-0',
                    )}
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      setDeleteConfirmation(true);
                    }}
                  >
                    <Trash2 size={16} /> Eliminar
                  </button>
                )}
                {deleteConfirmation ? (
                  <>
                    <button
                      className={dialogFooterButton}
                      type="button"
                      onClick={() => setDeleteConfirmation(false)}
                    >
                      Manter serviço
                    </button>
                    <button
                      className={cn(
                        dialogFooterButton,
                        'confirm-delete-btn border-[rgba(190,80,80,0.55)] bg-[#7f3030] font-bold text-[#fff1f1]',
                      )}
                      type="button"
                      disabled={deletion.isPending}
                      onClick={() => deletion.mutate()}
                    >
                      {deletion.isPending ? (
                        <LoaderCircle className="animate-spin" size={17} />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      {deletion.isPending ? 'A eliminar...' : 'Confirmar eliminação'}
                    </button>
                  </>
                ) : (
                  <>
                    <button className={dialogFooterButton} type="button" onClick={closeForm}>
                      Cancelar
                    </button>
                    <button
                      className={cn(dialogFooterButton, 'border-gold-accent bg-[linear-gradient(135deg,#e0b96f,#a87934)] font-bold text-[#17130d]')}
                      type="submit"
                      disabled={saveService.isPending}
                    >
                      {saveService.isPending ? (
                        <>
                          <LoaderCircle className="animate-spin" size={17} /> A guardar...
                        </>
                      ) : (
                        <>
                          {editingService ? <Pencil size={17} /> : <Plus size={17} />}
                          {editingService ? 'Guardar alterações' : 'Criar serviço'}
                        </>
                      )}
                    </button>
                  </>
                )}
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function ServiceState({
  title,
  description,
  loading,
  action,
}: {
  title: string;
  description: string;
  loading?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-[0.8rem] flex min-h-[22rem] flex-col items-center justify-center rounded-xl border border-[rgba(226,216,195,0.11)] bg-[#10110e] p-8 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-[rgba(200,154,75,0.08)] text-gold-light">
        {loading ? <LoaderCircle className="animate-spin" /> : <Scissors />}
      </span>
      <h3 className="mt-4 text-[0.95rem]">{title}</h3>
      <p className="mt-2 mb-4 max-w-[26rem] text-[0.73rem] leading-[1.6] text-[#858880]">
        {description}
      </p>
      {action}
    </div>
  );
}
