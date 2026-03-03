import { useEffect, useRef, useState } from "react";
import { ContractInstance, JobDef } from "../../core/types";

interface ContractCarouselProps {
  contracts: ContractInstance[];
  jobsById: Map<string, JobDef>;
  selectedContractId: string | null;
  onSelect: (contractId: string) => void;
}

export function ContractCarousel({ contracts, jobsById, selectedContractId, onSelect }: ContractCarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    syncScrollState();
  }, [contracts.length, selectedContractId]);

  function syncScrollState() {
    const track = trackRef.current;
    if (!track) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    setCanScrollLeft(track.scrollLeft > 4);
    setCanScrollRight(track.scrollLeft < maxScrollLeft - 4);
  }

  function nudge(direction: "left" | "right") {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const delta = Math.max(180, Math.floor(track.clientWidth * 0.72)) * (direction === "left" ? -1 : 1);
    track.scrollBy({ left: delta, behavior: "smooth" });
    window.setTimeout(() => syncScrollState(), 180);
  }

  return (
    <div className="contract-carousel-shell">
      <div className="contract-carousel-nav">
        <button
          type="button"
          className="icon-button carousel-arrow"
          aria-label="Scroll contracts left"
          disabled={!canScrollLeft}
          onClick={() => nudge("left")}
        >
          {"<"}
        </button>
        <button
          type="button"
          className="icon-button carousel-arrow"
          aria-label="Scroll contracts right"
          disabled={!canScrollRight}
          onClick={() => nudge("right")}
        >
          {">"}
        </button>
      </div>
      <div ref={trackRef} className="contract-carousel" role="tablist" aria-label="Contract board carousel" onScroll={syncScrollState}>
        {contracts.map((contract) => {
          const job = jobsById.get(contract.jobId);
          if (!job) {
            return null;
          }
          const active = contract.contractId === selectedContractId;
          return (
            <button
              key={contract.contractId}
              className={active ? "carousel-card active" : "carousel-card"}
              onClick={() => onSelect(contract.contractId)}
              role="tab"
              aria-selected={active}
            >
              <strong>{job.name}</strong>
              <span>${Math.round(job.basePayout * contract.payoutMult)}</span>
              <small>{Math.round(job.risk * 100)}% risk</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
