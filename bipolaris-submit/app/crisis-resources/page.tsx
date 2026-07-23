import { CrisisResourcesList } from "@/components/crisis-resources"

export default function CrisisResourcesPage() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="max-w-md mx-auto">
        <div className="px-5 pt-8 pb-4">
          <p className="text-sm text-muted-foreground mb-1">BiPolaris</p>
          <h1 className="text-2xl font-semibold text-foreground mb-2">危机资源与热线</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            用于心理危机、强烈痛苦、自伤/自杀风险或无法自控时寻求现实支持。
          </p>
        </div>
        <CrisisResourcesList source="resources_page" />
      </div>
    </main>
  )
}
