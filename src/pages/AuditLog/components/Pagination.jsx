import Icon from "../../../components/ui/Icon";

export default function Pagination({ page, totalPages, totalRows, onChange }) {
    return (
        <div className="al-pagination">
            <div className="al-pagination__controls">
                <button
                    className="al-pagination__btn"
                    disabled={page === 1}
                    onClick={() => onChange(1)}
                >
                    <Icon name="chevrons-left" />
                </button>
                <button
                    className="al-pagination__btn"
                    disabled={page === 1}
                    onClick={() => onChange(page - 1)}
                >
                    <Icon name="chevron-left" />
                </button>
                <span className="al-pagination__page">
                    {page} / {totalPages}
                </span>
                <button
                    className="al-pagination__btn"
                    disabled={page === totalPages}
                    onClick={() => onChange(page + 1)}
                >
                    <Icon name="chevron-right" />
                </button>
                <button
                    className="al-pagination__btn"
                    disabled={page === totalPages}
                    onClick={() => onChange(totalPages)}
                >
                    <Icon name="chevrons-right" />
                </button>
            </div>
            <span className="al-pagination__total">{totalRows} rows</span>
        </div>
    );
}