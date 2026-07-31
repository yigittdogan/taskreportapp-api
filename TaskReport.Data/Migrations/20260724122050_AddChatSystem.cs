using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskReport.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddChatSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // SADECE MESSAGES TABLOSU OLUŞTURULACAK
            migrationBuilder.CreateTable(
                name: "Messages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SenderId = table.Column<int>(type: "int", nullable: false),
                    ReceiverId = table.Column<int>(type: "int", nullable: false),
                    Content = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsRead = table.Column<bool>(type: "bit", nullable: false),

                    // SİLME ÖZELLİĞİ İÇİN GEREKLİ OLAN SÜTUNLARI DA MANUEL EKLEDİK
                    IsDeletedBySender = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    IsDeletedByReceiver = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Messages", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // GERİ ALINIRSA SADECE MESSAGES TABLOSU SİLİNECEK
            migrationBuilder.DropTable(
                name: "Messages");
        }
    }
}