"""change notes to text

Revision ID: 1d293ffb2569
Revises: None
Create Date: 2026-07-03 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1d293ffb2569'
down_revision: Union[str, None] = '000000000000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Alter column notes to type Text
    if op.get_bind().dialect.name != 'sqlite':
        op.alter_column('inspections', 'notes',
                   existing_type=sa.String(length=500),
                   type_=sa.Text(),
                   existing_nullable=True)


def downgrade() -> None:
    # Revert notes column to String(500)
    if op.get_bind().dialect.name != 'sqlite':
        op.alter_column('inspections', 'notes',
                   existing_type=sa.Text(),
                   type_=sa.String(length=500),
                   existing_nullable=True)
