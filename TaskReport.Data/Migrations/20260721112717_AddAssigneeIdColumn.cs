using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskReport.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAssigneeIdColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AssigneeId",
                table: "TaskItems",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AssigneeId",
                table: "TaskItems");
        }
    }
}
