import {
  AlertTriangle,
  Building2,
  Check,
  Copy,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { SortableList } from '../components/common/sortable-list'
import { useListOrder } from '../hooks/use-list-order'
import { useScheduleStore } from '../store/use-schedule-store'
import { formatAddressOneLine } from '../utils/address-utils'
import { copyToClipboard } from '../utils/clipboard-utils'
import { sortByListOrder } from '../utils/list-order'

import type { Address } from '../types'

interface AddressModalProps {
  isOpen: boolean
  addressToEdit: Address | null
  onClose: () => void
  onSave: (addressData: Omit<Address, 'id'>) => void
}

function AddressModal({
  isOpen,
  addressToEdit,
  onClose,
  onSave,
}: AddressModalProps) {
  const { t } = useTranslation(['addresses', 'common'])
  const [name, setName] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (addressToEdit) {
      setName(addressToEdit.name || '')
      setStreet(addressToEdit.street || '')
      setNumber(addressToEdit.number || '')
      setComplement(addressToEdit.complement || '')
      setNeighborhood(addressToEdit.neighborhood || '')
      setCity(addressToEdit.city || '')
    } else {
      setName('')
      setStreet('')
      setNumber('')
      setComplement('')
      setNeighborhood('')
      setCity('')
    }
    setError(null)
  }, [addressToEdit, isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('addresses:errors.nameRequired'))
      return
    }
    if (!street.trim()) {
      setError(t('addresses:errors.streetRequired'))
      return
    }
    if (!number.trim()) {
      setError(t('addresses:errors.numberRequired'))
      return
    }

    onSave({
      name: name.trim(),
      street: street.trim(),
      number: number.trim(),
      complement: complement.trim() || undefined,
      neighborhood: neighborhood.trim() || undefined,
      city: city.trim() || undefined,
    })
    onClose()
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="modal-overlay fixed inset-0 z-120 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn"
    >
      <div className="modal-panel bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="modal-header flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
              <MapPin className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {addressToEdit
                  ? t('addresses:editAddress')
                  : t('addresses:newAddress')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('addresses:subtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title={t('common:actions.close')}
            aria-label={t('common:actions.close')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="modal-form"
        >
          <div className="modal-body p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="address-name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('addresses:name')}
              </label>
              <input
                id="address-name"
                type="text"
                required
                aria-invalid={error === t('addresses:errors.nameRequired')}
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (error) setError(null)
                }}
                placeholder={t('addresses:namePlaceholder')}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label
                  htmlFor="address-street"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('addresses:street')}
                </label>
                <input
                  id="address-street"
                  type="text"
                  required
                  aria-invalid={error === t('addresses:errors.streetRequired')}
                  value={street}
                  onChange={(e) => {
                    setStreet(e.target.value)
                    if (error) setError(null)
                  }}
                  placeholder={t('addresses:streetPlaceholder')}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label
                  htmlFor="address-number"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('addresses:number')}
                </label>
                <input
                  id="address-number"
                  type="text"
                  required
                  aria-invalid={error === t('addresses:errors.numberRequired')}
                  value={number}
                  onChange={(e) => {
                    setNumber(e.target.value)
                    if (error) setError(null)
                  }}
                  placeholder={t('addresses:numberPlaceholder')}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="address-complement"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('addresses:complement')}
              </label>
              <input
                id="address-complement"
                type="text"
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                placeholder={t('addresses:complementPlaceholder')}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="address-neighborhood"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('addresses:neighborhood')}
                </label>
                <input
                  id="address-neighborhood"
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder={t('addresses:neighborhoodPlaceholder')}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label
                  htmlFor="address-city"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('addresses:city')}
                </label>
                <input
                  id="address-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t('addresses:cityPlaceholder')}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>

          <div className="modal-footer px-6 py-4 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              {t('common:actions.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition shadow-xs"
            >
              {addressToEdit
                ? t('addresses:saveChanges')
                : t('addresses:createButton')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

interface ConfirmDeleteAddressModalProps {
  isOpen: boolean
  address: Address | null
  onClose: () => void
  onConfirm: () => void
}

function ConfirmDeleteAddressModal({
  isOpen,
  address,
  onClose,
  onConfirm,
}: ConfirmDeleteAddressModalProps) {
  const { t } = useTranslation(['addresses', 'common'])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !address) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="modal-overlay fixed inset-0 z-130 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn"
    >
      <div className="modal-panel bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden flex flex-col transition-colors">
        <div className="modal-header flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-rose-50/60 dark:bg-rose-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 shadow-2xs">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('addresses:confirmDeleteTitle')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('addresses:confirmDeleteDescription')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title={t('common:actions.close')}
            aria-label={t('common:actions.close')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body p-6 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {address.name} ({address.street}, {address.number})
          </p>
        </div>

        <div className="modal-footer px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            {t('common:actions.cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('addresses:confirmDelete')}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function AddressManagementView() {
  const { t } = useTranslation(['addresses', 'common'])
  const { addresses, addAddress, updateAddress, deleteAddress } =
    useScheduleStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [addressToEdit, setAddressToEdit] = useState<Address | null>(null)
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null)
  const [copiedAddressId, setCopiedAddressId] = useState<string | null>(null)

  const { order: addressOrder, handleReorder } = useListOrder('addresses')
  const sortedAddresses = sortByListOrder(addresses, addressOrder)
  const filteredAddresses = sortedAddresses.filter((a) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      (a.name && a.name.toLowerCase().includes(q)) ||
      a.street.toLowerCase().includes(q) ||
      a.number.toLowerCase().includes(q) ||
      (a.complement && a.complement.toLowerCase().includes(q)) ||
      (a.neighborhood && a.neighborhood.toLowerCase().includes(q)) ||
      (a.city && a.city.toLowerCase().includes(q))
    )
  })

  const handleCopy = async (addr: Address) => {
    const textToCopy = formatAddressOneLine(addr)
    const success = await copyToClipboard(textToCopy)
    if (success) {
      setCopiedAddressId(addr.id)
      setTimeout(() => {
        setCopiedAddressId((curr) => (curr === addr.id ? null : curr))
      }, 2000)
    }
  }

  const handleOpenAdd = () => {
    setAddressToEdit(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (addr: Address) => {
    setAddressToEdit(addr)
    setIsModalOpen(true)
  }

  const handleSave = (data: Omit<Address, 'id'>) => {
    if (addressToEdit) {
      updateAddress(addressToEdit.id, data)
    } else {
      addAddress(data)
    }
  }

  return (
    <div className="flex-1 h-full overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6 max-w-[1500px] w-full mx-auto custom-scrollbar">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
            <MapPin className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('addresses:title')}
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {t('addresses:subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-xs transition-all shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{t('addresses:newAddress')}</span>
          </button>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={t('addresses:searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs md:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 self-end sm:self-center">
          <span className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
            {t('addresses:totalBadge', {
              count: addresses.length,
              label:
                addresses.length === 1
                  ? t('addresses:addressSingular')
                  : t('addresses:addressPlural'),
            })}
          </span>
        </div>
      </div>

      {/* Address List */}
      {filteredAddresses.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
          <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm md:text-base font-bold text-slate-700 dark:text-slate-300">
            {searchQuery
              ? t('addresses:noSearchResults')
              : t('addresses:emptyList')}
          </h3>
          {!searchQuery && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition"
            >
              <Plus className="w-4 h-4" />
              <span>{t('addresses:addFirstAddress')}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SortableList
            items={filteredAddresses}
            layout="grid"
            getItemLabel={(addr) => addr.name}
            onReorder={(activeId, overId) =>
              handleReorder(sortedAddresses.map((item) => item.id), activeId, overId)
            }
            renderItem={(addr, dragHandle) => (
              <div
                className="h-full bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-4 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="self-center">{dragHandle}</div>
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {addr.name}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {addr.street}, {addr.number}
                        </p>
                      </div>
                    </div>
                  </div>

                  {addr.complement && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 pl-10">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">
                        {t('addresses:complementAbbr')}{' '}
                      </span>
                      {addr.complement}
                    </p>
                  )}

                  {(addr.neighborhood || addr.city) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 pl-10">
                      {[addr.neighborhood, addr.city].filter(Boolean).join(' - ')}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleCopy(addr)}
                    title={
                      copiedAddressId === addr.id
                        ? t('addresses:copied')
                        : t('addresses:copyAddress')
                    }
                    aria-label={t('addresses:copyAddressFor', {
                      name: addr.name,
                    })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      copiedAddressId === addr.id
                        ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50'
                        : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {copiedAddressId === addr.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{t('addresses:copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t('common:actions.copy')}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(addr)}
                    title={t('common:actions.edit')}
                    aria-label={t('addresses:editAddressFor', {
                      name: addr.name,
                    })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{t('common:actions.edit')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddressToDelete(addr)}
                    title={t('common:actions.delete')}
                    aria-label={t('addresses:deleteAddressFor', {
                      name: addr.name,
                    })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('common:actions.delete')}</span>
                  </button>
                </div>
              </div>
            )}
          />
        </div>
      )}

      {/* Modal Add / Edit */}
      <AddressModal
        isOpen={isModalOpen}
        addressToEdit={addressToEdit}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />

      {/* Modal Confirm Delete */}
      <ConfirmDeleteAddressModal
        isOpen={Boolean(addressToDelete)}
        address={addressToDelete}
        onClose={() => setAddressToDelete(null)}
        onConfirm={() => {
          if (addressToDelete) {
            deleteAddress(addressToDelete.id)
          }
        }}
      />
    </div>
  )
}
