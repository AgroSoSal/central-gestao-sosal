"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Props = {
  branches: readonly string[]
  selectedBranch: string
}

/** A seleção Radix mantém o valor no GET do formulário sem usar o menu nativo claro. */
export function BranchFilterSelect({ branches, selectedBranch }: Props) {
  return (
    <Select name="loja" defaultValue={selectedBranch || "todas"}>
      <SelectTrigger
        id="loja"
        aria-label="Filial"
        className="h-12 rounded-xl border-[#26334b] bg-[#101a2a] px-3.5 text-[13px] font-medium text-slate-100 shadow-inner shadow-black/20 transition-colors hover:border-cyan-500/50 focus:ring-cyan-400/40 focus:ring-offset-0"
      >
        <SelectValue placeholder="Todas as filiais" />
      </SelectTrigger>
      <SelectContent className="rounded-xl border-[#2a3b57] bg-[#0e1727] p-1 text-slate-100 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)]">
        <SelectItem value="todas" className="rounded-lg py-2.5 focus:bg-cyan-400/15 focus:text-cyan-100">
          Todas as filiais
        </SelectItem>
        {branches.map((branch) => (
          <SelectItem key={branch} value={branch} className="rounded-lg py-2.5 focus:bg-cyan-400/15 focus:text-cyan-100">
            {branch}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
