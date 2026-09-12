interface TablePaginationProps {
  page: number;
  totalPages: number;
  totalRows: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({ page, totalPages, totalRows, onPageChange }: TablePaginationProps) {
  return (
    <nav aria-label="Paginación de la tabla" className="ui-table__pagination">
      <p>{totalRows} {totalRows === 1 ? "resultado" : "resultados"}</p>
      {totalPages > 1 ? <div>
        <button
          aria-label="Página anterior"
          disabled={page <= 1}
          type="button"
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </button>
        <span aria-live="polite">Página {page} de {totalPages}</span>
        <button
          aria-label="Página siguiente"
          disabled={page >= totalPages}
          type="button"
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
        </button>
      </div> : null}
    </nav>
  );
}
