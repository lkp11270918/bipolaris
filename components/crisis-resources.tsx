"use client"

import { Phone, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { crisisResources, telHref, type CrisisResource } from "@/lib/crisis-resources"
import { trackEvent } from "@/lib/bipolaris-api"

const regions = ["全部", "中国", "美国", "爱尔兰", "加拿大"]

function ResourceCard({ resource, source }: { resource: CrisisResource; source: string }) {
  const region = [resource.province, resource.city].filter(Boolean).join(" · ") || resource.country

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">{resource.name}</p>
          <p className="text-xs text-muted-foreground mt-1">{region}</p>
        </div>
        {resource.hours.includes("24") && (
          <span className="shrink-0 text-[11px] font-medium text-green-700 bg-green-100 rounded-full px-2 py-1">
            24小时
          </span>
        )}
      </div>

      <a
        href={telHref(resource.phone)}
        onClick={() =>
          trackEvent("hotline_clicked", {
            hotline: resource.id,
            phone: resource.phone,
            source,
          })
        }
        className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-destructive/10 text-destructive px-3 py-3 text-sm font-medium active:scale-[0.98] transition-transform"
      >
        <Phone className="w-4 h-4" />
        {resource.phone}
      </a>

      <div className="mt-3 space-y-1 text-xs text-muted-foreground leading-relaxed">
        <p>服务时间：{resource.hours}</p>
        {resource.audience && <p>服务对象：{resource.audience}</p>}
        {resource.operator && <p>主办单位：{resource.operator}</p>}
        {resource.notes && <p>备注：{resource.notes}</p>}
      </div>
    </div>
  )
}

export function CrisisResourcesList({
  compact = false,
  source = "crisis_resources",
}: {
  compact?: boolean
  source?: string
}) {
  const [query, setQuery] = useState("")
  const [region, setRegion] = useState("全部")

  const resources = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return crisisResources.filter((resource) => {
      const matchesRegion = region === "全部" || resource.country === region
      const haystack = [
        resource.country,
        resource.province,
        resource.city,
        resource.name,
        resource.phone,
        resource.hours,
        resource.audience,
        resource.operator,
        resource.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return matchesRegion && (!normalized || haystack.includes(normalized))
    })
  }, [query, region])

  return (
    <div className={compact ? "space-y-4" : "px-5 pb-8 space-y-4"}>
      <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4">
        <p className="text-sm font-medium text-destructive mb-1">如果存在立即危险</p>
        <p className="text-xs text-destructive/80 leading-relaxed">
          请优先拨打当地急救电话，或联系身边可信任的人陪你获得现实支持。BiPolaris 不能替代急救服务。
        </p>
      </div>

      <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-4 py-2">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索城市、热线或电话"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none py-1.5"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {regions.map((item) => (
          <button
            key={item}
            onClick={() => setRegion(item)}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-medium border transition-colors ${
              region === item
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {resources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} source={source} />
        ))}
        {resources.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-sm text-foreground">没有找到匹配资源</p>
            <p className="text-xs text-muted-foreground mt-1">可以尝试搜索城市、国家或电话。</p>
          </div>
        )}
      </div>
    </div>
  )
}
