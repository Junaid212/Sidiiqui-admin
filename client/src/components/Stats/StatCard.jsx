export default function StatCard({ title, value, icon: Icon, color, subtitle }) {
    return (
        <div className="stat-card" style={{ '--card-accent': color }}>
            <div className="stat-card__header">
                <div className="stat-card__icon-wrap">
                    {Icon && <Icon className="stat-card__icon" />}
                </div>
                <div className="stat-card__info">
                    <span className="stat-card__title">{title}</span>
                    {subtitle && <span className="stat-card__subtitle">{subtitle}</span>}
                </div>
            </div>
            <div className="stat-card__value">{value}</div>
        </div>
    );
}
