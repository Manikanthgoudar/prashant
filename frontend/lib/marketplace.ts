import { OrderItemStatus } from '@/types'

export const DELIVERY_FREE_THRESHOLD = 500
export const DEFAULT_DELIVERY_CHARGE = 50

export function getCommissionRatePercent(): number {
    const fromEnv = Number(process.env.PLATFORM_COMMISSION_RATE || 10)
    if (Number.isNaN(fromEnv) || fromEnv < 0) return 10
    return fromEnv
}

export function getDeliveryCharge(subtotal: number): number {
    return subtotal >= DELIVERY_FREE_THRESHOLD ? 0 : DEFAULT_DELIVERY_CHARGE
}

export function makeTrackingNumber(prefix = 'TRK'): string {
    const time = Date.now().toString(36).toUpperCase()
    const random = Math.floor(Math.random() * 99999)
        .toString()
        .padStart(5, '0')
    return `${prefix}-${time}-${random}`
}

export const ORDER_PROGRESS_FLOW: OrderItemStatus[] = [
    'placed',
    'processing',
    'shipped',
    'delivered',
    'completed'
]

export const CANCELLABLE_STATUSES = new Set<OrderItemStatus>(['placed', 'processing'])

export const RETURNABLE_STATUSES = new Set<OrderItemStatus>(['shipped', 'delivered', 'completed'])

export function statusWeight(status: OrderItemStatus): number {
    const weights: Record<OrderItemStatus, number> = {
        placed: 1,
        processing: 2,
        shipped: 3,
        delivered: 4,
        completed: 5,
        cancelled: 6,
        return_requested: 7,
        returned: 8,
        refunded: 9
    }

    return weights[status]
}

export function deriveOrderStatus(itemStatuses: OrderItemStatus[]): string {
    if (!itemStatuses.length) return 'placed'

    if (itemStatuses.every((status) => status === 'cancelled')) return 'cancelled'
    if (itemStatuses.every((status) => status === 'refunded')) return 'refunded'
    if (itemStatuses.every((status) => status === 'returned' || status === 'refunded')) return 'returned'
    if (itemStatuses.some((status) => status === 'return_requested')) return 'returned'

    const sorted = [...itemStatuses].sort((a, b) => statusWeight(a) - statusWeight(b))
    return sorted[0]
}

export function effectiveProductPrice(price: number, discountPercent: number): number {
    const discount = (price * Math.max(0, discountPercent || 0)) / 100
    return Math.max(0, Number((price - discount).toFixed(2)))
}
