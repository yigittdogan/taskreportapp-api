using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskReport.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAgilePropertiesToTask : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EpicId",
                table: "TaskItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "TaskItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Type",
                table: "TaskItems",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EpicId",
                table: "TaskItems");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "TaskItems");

            migrationBuilder.DropColumn(
                name: "Type",
                table: "TaskItems");
        }
    }
}
