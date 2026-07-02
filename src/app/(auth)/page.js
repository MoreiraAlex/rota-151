'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const STATUS_LABEL = {
    1: 'Aberta',
    2: 'Em andamento',
    3: 'Concluída',
    4: 'Cancelada',
  }

  const stats = [
    { label: 'Ordens Abertas', value: data?.stats?.openCount ?? 0 },
    { label: 'Ordens em Andamento', value: data?.stats?.inProgressCount ?? 0 },
    { label: 'Ordens Finalizadas (Hoje)', value: data?.stats?.closeCount ?? 0 },
    { label: 'Ordens Canceladas (Mês)', value: data?.stats?.cancelCount ?? 0 },
    { label: 'Total no Mês', value: data?.stats?.totalCount ?? 0 },
  ]

  const chartData = data?.chart ?? []
  const chartConfig = {
    total: {
      label: 'Ordem',
      color: 'hsl(var(--primary))',
    },
  }

  const recentMessages =
    data?.messages?.map((m) => ({
      id: m.id,
      contact: `${m.contact?.name} (${m.contact?.phone})`,
      content: m.content,
      createdAt: m.createdAt,
    })) ?? []

  const recentOrders =
    data?.orders?.map((o) => ({
      number: o.number ?? o.id,
      clientName: o.clientName ?? 'Cliente',
      vehicleBrand: o.vehicleBrand ?? '-',
      vehicleModel: o.vehicleModel ?? '-',
      vehicleYear: o.vehicleYear ?? '-',
      status: o.status,
      createdAt: new Date(o.createdAt).toLocaleString('pt-BR'),
    })) ?? []

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dashboard', {
          credentials: 'include',
        })
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error('dashboard error', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <h1 className="text-xl sm:text-2xl font-semibold">Visão Geral</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {loading
          ? [...Array(5)].map((_, i) => (
              <div key={i} className="flex">
                <Skeleton className="h-24 w-full" />
              </div>
            ))
          : stats.map((item) => (
              <Card key={item.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    {item.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{item.value}</span>
                </CardContent>
              </Card>
            ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ordens de Serviço — Últimos dias</CardTitle>
        </CardHeader>

        <CardContent className="h-[260px]">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ChartContainer config={chartConfig} className="h-full w-full">
              <LineChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-total)"
                  strokeWidth={2}
                  dot={true}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Últimas Ordens de Serviço</CardTitle>
          <Link href="/order">
            <Button
              variant="outline"
              size="sm"
              className="self-start sm:self-auto"
            >
              Ver todas
            </Button>
          </Link>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="flex">
                  <Skeleton className="h-14 w-full" />
                </div>
              ))
            ) : recentOrders.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nenhuma ordem encontrada.
              </div>
            ) : (
              recentOrders.map((order) => (
                <div
                  key={order.number}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border rounded-lg p-3"
                >
                  <div>
                    <p className="font-medium">
                      OS #{order.number} — {order.clientName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {order.vehicleBrand} {order.vehicleModel}(
                      {order.vehicleYear}) • {order.createdAt}
                    </p>
                  </div>

                  <div className="flex justify-end sm:justify-start">
                    <Badge variant="outline">
                      {STATUS_LABEL[order.status] ?? 'Desconhecido'}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {data?.user?.role === 'admin' && (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Últimas Mensagens Recebidas</CardTitle>
            <Link href="/message">
              <Button variant="outline" size="sm">
                Ver conversas
              </Button>
            </Link>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="flex">
                    <Skeleton className="h-14 w-full" />
                  </div>
                ))
              ) : recentMessages.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhuma mensagem recebida.
                </div>
              ) : (
                recentMessages.map((msg) => (
                  <div key={msg.id} className="border rounded-lg p-3 ">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{msg.contact}</p>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.createdAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {msg.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
